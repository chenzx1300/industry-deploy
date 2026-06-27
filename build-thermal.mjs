// Thermal materials (高导热材料) industry build (one-shot, real RSS data).
// Invoke: node build-thermal.mjs

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { buildNewsItems } from './src/lib/news-scraper.mjs';
import { renderIndustryPage, renderHomepage } from './src/pipeline/render.mjs';
import { addToManifest, loadManifest } from './src/pipeline/manifest.mjs';

const SLUG = 'thermal-materials-industry';
const DATA_DIR = 'data';
const OUT_DIR = 'docs';
const PER_COMPANY = 10;

// Load companies + prompt from data/industries.json
const industries = JSON.parse(readFileSync(`${DATA_DIR}/industries.json`, 'utf-8')).industries;
const industry = industries.find(i => i.slug === SLUG);
if (!industry) {
  console.error(`Industry '${SLUG}' not found in ${DATA_DIR}/industries.json`);
  process.exit(1);
}
const PROMPT = industry.prompt;
const COMPANIES = industry.companies;

const generated_at = new Date().toISOString();
const companies = await Promise.all(COMPANIES.map(async c => {
  const news = await buildNewsItems([], c.name, c.news_url, PER_COMPANY, {
    siteDomain: c.domain,
    fallbackNews: c.fallback_news,
  });
  return { ...c, news };
}));

const totalNews = companies.reduce((s, c) => s + c.news.length, 0);
const totalFallbacks = companies.reduce(
  (s, c) => s + c.news.filter(n => n.title.startsWith('查看 ')).length, 0
);

console.log(`✓ ${totalNews} news across ${companies.length} companies (${totalFallbacks} fallbacks)`);
for (const c of companies) console.log(`  · ${c.name}: ${c.news.length} 条`);

const data = { slug: SLUG, prompt: PROMPT, generated_at, companies };
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

console.log(`\n✓ docs/${SLUG}/index.html`);
console.log(`✓ docs/index.html (homepage, all industries)`);