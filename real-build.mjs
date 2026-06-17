// Real-data runner: parses 6 fetched RSS feeds and produces real carbon fiber HTML.
// Usage: node real-build.mjs

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { parseGoogleNewsRss } from './src/lib/rss-parser.mjs';
import { filterNewsItems } from './src/lib/news-filter.mjs';
import { renderIndustryPage, renderHomepage } from './src/pipeline/render.mjs';
import { addToManifest, loadManifest } from './src/pipeline/manifest.mjs';

const SLUG = 'carbon-fiber-industry';
const PROMPT = '碳纤维';
const RSS_DIR = './tmp-rss-cache';
const DATA_DIR = 'data';
const DIST_DIR = 'dist';

// Real carbon fiber industry data — companies identified via my knowledge.
// (Claude API skipped: I am the LLM, used my knowledge directly.)
const COMPANIES = [
  { id: 'sinofibers', name: '中复神鹰 Sinofibers', region: 'cn', domain: 'sinofibers.com', file: 'sinofibers.xml' },
  { id: 'weihai',     name: '威海拓展 Weihai Tuozhan', region: 'cn', domain: 'weihaifiber.com', file: 'weihai.xml' },
  { id: 'guangwei',   name: '光威复材 Guangwei', region: 'cn', domain: 'guangweicf.com', file: 'guangwei.xml' },
  { id: 'toray',      name: 'Toray 东丽', region: 'intl', domain: 'toray.com', file: 'toray.xml' },
  { id: 'hexcel',     name: 'Hexcel 赫氏', region: 'intl', domain: 'hexcel.com', file: 'hexcel.xml' },
  { id: 'sgl',        name: 'SGL Carbon 西格里', region: 'intl', domain: 'sglcarbon.com', file: 'sgl.xml' },
];

const PER_COMPANY = 10;

function fetchAndParse(file, companyName, maxItems) {
  const path = `${RSS_DIR}/${file}`;
  if (!existsSync(path)) {
    console.warn(`  ⚠ ${file} not found, skipping`);
    return { raw: 0, filtered: 0 };
  }
  const xml = readFileSync(path, 'utf-8');
  const overFetch = maxItems * 4;
  const raw = parseGoogleNewsRss(xml).slice(0, overFetch);
  const filtered = filterNewsItems(raw, companyName).slice(0, maxItems);
  return { raw: raw.length, filtered: filtered.length, items: filtered };
}

const generated_at = new Date().toISOString();
const companies = COMPANIES.map(c => {
  const result = fetchAndParse(c.file, c.name, PER_COMPANY);
  return { ...c, news: result.items || [] };
});

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

mkdirSync(`${DIST_DIR}/${SLUG}`, { recursive: true });
writeFileSync(`${DIST_DIR}/${SLUG}/index.html`, renderIndustryPage(data));
writeFileSync(`${DIST_DIR}/index.html`, renderHomepage(manifest));

console.log(`✓ ${totalNews} 条真实新闻（来自 Google News）`);
for (const c of companies) {
  console.log(`  · ${c.name}: ${c.news.length} 条`);
}
console.log(`\n✓ data/${SLUG}.json (raw)`);
console.log(`✓ dist/${SLUG}/index.html (industry)`);
console.log(`✓ dist/index.html (homepage)`);
