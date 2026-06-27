#!/usr/bin/env node
// Daily update runner: for each industry, fetches fresh news using the same
// buildNewsItems() chain as the one-shot build scripts. Writes JSON + HTML,
// updates homepage, records a summary.
//
// Strategy per company (in buildNewsItems, src/lib/news-scraper.mjs):
//   1. Direct news center scraping (fetch + Playwright)
//   2. Bing News EN (broadest results, returns real publisher URLs)
//   3. EEFocus (CN electronics industry site)
//   4. Google News RSS (last resort)
//
// Usage: node scripts/daily-update.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildNewsItems } from '../src/lib/news-scraper.mjs';
import { renderIndustryPage, renderHomepage } from '../src/pipeline/render.mjs';
import { addToManifest, loadManifest } from '../src/pipeline/manifest.mjs';

const DATA_DIR = 'data';
const DIST_DIR = 'docs';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const PER_COMPANY = 10;

async function buildOne(industry) {
  console.log(`▸ Building "${industry.prompt}" (${industry.slug})`);
  const companies = industry.companies;

  const results = await Promise.all(companies.map(async c => {
    try {
      const news = await buildNewsItems([], c.name, c.news_url, PER_COMPANY, {
        siteDomain: c.domain,
        fallbackNews: c.fallback_news,
      });
      const { ...rest } = c;
      return { ...rest, news };
    } catch (err) {
      console.error(`  ⚠ ${c.name}: ${err.message}`);
      return { ...c, news: [] };
    }
  }));

  const totalNews = results.reduce((s, c) => s + c.news.length, 0);
  const totalFallbacks = results.reduce(
    (s, c) => s + c.news.filter(n => n.title.startsWith('查看 ')).length, 0
  );
  console.log(`  ✓ ${totalNews} news items across ${results.length} companies (${totalFallbacks} fallbacks)`);

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

  return {
    slug: industry.slug,
    prompt: industry.prompt,
    news_count: totalNews,
    fallback_count: totalFallbacks,
    total_companies: results.length,
  };
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