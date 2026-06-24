#!/usr/bin/env node
// Daily update runner: reads data/industries.json, fetches fresh RSS for each,
// renders HTML, writes to docs/. Designed to run via GitHub Actions cron.
//
// Usage: node scripts/daily-update.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchNewsForCompanies } from '../src/pipeline/fetch-news.mjs';
import { renderIndustryPage, renderHomepage } from '../src/pipeline/render.mjs';
import { addToManifest, loadManifest } from '../src/pipeline/manifest.mjs';

const DATA_DIR = 'data';
const DIST_DIR = 'docs';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');

async function curlRss(domain, hl = 'en-US', gl = 'US', ceid = 'US:en') {
  const url = `https://news.google.com/rss/search?q=site:${encodeURIComponent(domain)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (industry-news-radar/1.0)' },
  });
  if (!res.ok) return '';
  return await res.text();
}

async function curlRssCn(domain) {
  // Try Chinese Google News for CN domains
  return curlRss(domain, 'zh-CN', 'CN', 'CN:zh-Hans');
}

function isLikelyCn(company) {
  return company.region === 'cn';
}

async function buildOne(industry) {
  console.log(`▸ Building "${industry.prompt}" (${industry.slug})`);
  const companies = industry.companies;
  const results = await Promise.all(companies.map(async c => {
    const xml = isLikelyCn(c) ? await curlRssCn(c.domain) : await curlRss(c.domain);
    // Parse via Node's fetch → fetchNewsForCompanies handles parse
    // We bypass fetchNewsForCompanies and inline the parse because we already have the XML
    const { parseGoogleNewsRss } = await import('../src/lib/rss-parser.mjs');
    const { filterNewsItems } = await import('../src/lib/news-filter.mjs');
    if (!xml) return { ...c, news: [] };
    const overFetch = 10 * 4;
    const all = parseGoogleNewsRss(xml).slice(0, overFetch);
    // Prefer company.news_url (curated news center) over the publisher homepage.
    const baseUrl = c.news_url || (all[0]?.direct_url);
    const items = all.map(i => ({ ...i, url: baseUrl || i.url }));
    const filtered = filterNewsItems(items, c.name).slice(0, 10);
    return { ...c, news: filtered };
  }));

  const totalNews = results.reduce((s, c) => s + c.news.length, 0);
  console.log(`  ✓ ${totalNews} news items across ${results.length} companies`);

  const data = {
    slug: industry.slug,
    prompt: industry.prompt,
    generated_at: new Date().toISOString(),
    companies: results,
  };

  await mkdir(join(DATA_DIR, industry.slug), { recursive: true });
  await writeFile(join(DATA_DIR, industry.slug + '.json'), JSON.stringify(data, null, 2));

  await mkdir(join(DIST_DIR, industry.slug), { recursive: true });
  await writeFile(join(DIST_DIR, industry.slug, 'index.html'), renderIndustryPage(data));

  await addToManifest(DATA_DIR, {
    slug: industry.slug,
    prompt: industry.prompt,
    company_count: results.length,
    news_count: totalNews,
    generated_at: data.generated_at,
  });

  return { slug: industry.slug, prompt: industry.prompt, news_count: totalNews, total_companies: results.length };
}

async function main() {
  const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  const industries = config.industries || [];

  console.log(`▸ Building ${industries.length} industries...\n`);

  const summary = [];
  for (const ind of industries) {
    try {
      const result = await buildOne(ind);
      summary.push({ ...result, ok: true });
    } catch (err) {
      console.error(`  ✗ ${ind.slug}: ${err.message}`);
      summary.push({ slug: ind.slug, prompt: ind.prompt, ok: false, error: err.message });
    }
  }

  // Render homepage
  const manifest = await loadManifest(DATA_DIR);
  await writeFile(join(DIST_DIR, 'index.html'), renderHomepage(manifest));

  // Write a summary file the workflow can read for the GitHub Issue
  const today = new Date().toISOString().slice(0, 10);
  await writeFile(
    join(DATA_DIR, 'latest-build.json'),
    JSON.stringify({ date: today, results: summary }, null, 2)
  );

  console.log(`\n✓ Done. Summary written to data/latest-build.json`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => { console.error('✗ Fatal:', err); process.exit(1); });