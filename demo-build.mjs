// One-off demo build: scrapes real news from each company's news center.
// No API keys required. Output goes to docs/.
// Usage: node demo-build.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { buildNewsItems } from './src/lib/news-scraper.mjs';
import { renderIndustryPage, renderHomepage } from './src/pipeline/render.mjs';
import { addToManifest, loadManifest } from './src/pipeline/manifest.mjs';

const SLUG = 'new-energy-vehicles-industry';
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

const generated_at = new Date().toISOString();
const companies = await Promise.all(COMPANIES.map(async c => ({
  ...c,
  news: await buildNewsItems([], c.name, c.news_url, PER_COMPANY, { siteDomain: c.domain }),
})));

const data = { slug: SLUG, prompt: PROMPT, generated_at, companies };
const totalNews = companies.reduce((s, c) => s + c.news.length, 0);

await mkdir(DATA_DIR, { recursive: true });
await writeFile(join(DATA_DIR, `${SLUG}.json`), JSON.stringify(data, null, 2));

await addToManifest(DATA_DIR, {
  slug: SLUG, prompt: PROMPT,
  company_count: companies.length, news_count: totalNews,
  generated_at,
});
const manifest = await loadManifest(DATA_DIR);

await mkdir(join(OUT_DIR, SLUG), { recursive: true });
await writeFile(join(OUT_DIR, SLUG, 'index.html'), renderIndustryPage(data));
await writeFile(join(OUT_DIR, 'index.html'), renderHomepage(manifest));

console.log(`✓ ${totalNews} 条真实新闻分布在 ${companies.length} 家公司`);
for (const c of companies) {
  console.log(`  · ${c.name}: ${c.news.length} 条`);
}
console.log(`\n✓ data/${SLUG}.json (raw)`);
console.log(`✓ ${OUT_DIR}/${SLUG}/index.html (industry)`);
console.log(`✓ ${OUT_DIR}/index.html (homepage)`);