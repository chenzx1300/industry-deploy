// Real-data runner: parses 6 fetched RSS feeds and produces real carbon fiber HTML.
// Usage: node real-build.mjs

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { parseGoogleNewsRss } from './src/lib/rss-parser.mjs';
import { buildNewsItems } from './src/lib/news-scraper.mjs';
import { renderIndustryPage, renderHomepage } from './src/pipeline/render.mjs';
import { addToManifest, loadManifest } from './src/pipeline/manifest.mjs';

const SLUG = 'carbon-fiber-industry';
const RSS_DIR = './tmp-rss-cache';
const DATA_DIR = 'data';
const OUT_DIR = 'docs';
const PER_COMPANY = 10;

// Load companies + prompt from data/industries.json (single source of truth).
const industries = JSON.parse(readFileSync(`${DATA_DIR}/industries.json`, 'utf-8')).industries;
const industry = industries.find(i => i.slug === SLUG);
if (!industry) {
  console.error(`Industry '${SLUG}' not found in ${DATA_DIR}/industries.json`);
  process.exit(1);
}
const PROMPT = industry.prompt;
const COMPANIES = industry.companies;

function fetchRssItems(file) {
  const path = `${RSS_DIR}/${file}`;
  if (!existsSync(path)) return [];
  const xml = readFileSync(path, 'utf-8');
  return parseGoogleNewsRss(xml).slice(0, PER_COMPANY * 4);
}

const generated_at = new Date().toISOString();
const companies = await Promise.all(COMPANIES.map(async c => {
  const rssItems = fetchRssItems(`${c.id}.xml`);
  const news = await buildNewsItems(rssItems, c.name, c.news_url, PER_COMPANY, {
    siteDomain: c.domain,
    fallbackNews: c.fallback_news,
  });
  return { ...c, news };
}));

const data = { slug: SLUG, prompt: PROMPT, generated_at, companies };
const totalNews = companies.reduce((s, c) => s + c.news.length, 0);

mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(`${DATA_DIR}/${SLUG}.json`, JSON.stringify(data, null, 2));

await addToManifest(DATA_DIR, {
  slug: SLUG, prompt: PROMPT,
  company_count: companies.length, news_count: totalNews,
  generated_at,
});
const manifest = await loadManifest(DATA_DIR);

mkdirSync(`${OUT_DIR}/${SLUG}`, { recursive: true });
writeFileSync(`${OUT_DIR}/${SLUG}/index.html`, renderIndustryPage(data));
writeFileSync(`${OUT_DIR}/index.html`, renderHomepage(manifest));

console.log(`✓ ${totalNews} 条真实新闻（来自公司新闻中心）`);
for (const c of companies) {
  console.log(`  · ${c.name}: ${c.news.length} 条`);
}
console.log(`\n✓ data/${SLUG}.json (raw)`);
console.log(`✓ ${OUT_DIR}/${SLUG}/index.html (industry)`);
console.log(`✓ ${OUT_DIR}/index.html (homepage)`);