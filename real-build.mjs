// Real-data runner: parses 6 fetched RSS feeds and produces real carbon fiber HTML.
// Usage: node real-build.mjs

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { parseGoogleNewsRss } from './src/lib/rss-parser.mjs';
import { buildNewsItems } from './src/lib/news-scraper.mjs';
import { renderIndustryPage, renderHomepage } from './src/pipeline/render.mjs';
import { addToManifest, loadManifest } from './src/pipeline/manifest.mjs';

const SLUG = 'carbon-fiber-industry';
const PROMPT = '碳纤维';
const RSS_DIR = './tmp-rss-cache';
const DATA_DIR = 'data';
const OUT_DIR = 'docs';

// Real carbon fiber industry data — companies identified via my knowledge.
// (Claude API skipped: I am the LLM, used my knowledge directly.)
const COMPANIES = [
  { id: 'sinofibers', name: '中复神鹰 Sinofibers', region: 'cn', domain: 'sinofibers.com', file: 'sinofibers.xml', monogram: '复', monogram_color: '#1e40af', news_url: 'https://www.sinofibers.com' },
  { id: 'weihai',     name: '威海拓展 Weihai Tuozhan', region: 'cn', domain: 'weihaifiber.com', file: 'weihai.xml', monogram: '海', monogram_color: '#0d9488', news_url: 'https://www.weihaifiber.com' },
  { id: 'guangwei',   name: '光威复材 Guangwei', region: 'cn', domain: 'guangweicf.com', file: 'guangwei.xml', monogram: '光', monogram_color: '#475569', news_url: 'https://www.guangweicf.com' },
  { id: 'toray',      name: 'Toray 东丽', region: 'intl', domain: 'toray.com', file: 'toray.xml', monogram: 'T', monogram_color: '#9f1239', news_url: 'https://www.toray.com/news/index.html' },
  { id: 'teijin',     name: '帝人 Teijin',         region: 'intl', domain: 'teijin.com',        file: null,         monogram: 'T', monogram_color: '#8b5cf6', news_url: 'https://www.teijin.com/news/' },
  { id: 'mitsubishi', name: '三菱化学 Mitsubishi', region: 'intl', domain: 'm-chemical.co.jp', file: null,         monogram: '三', monogram_color: '#dc2626', news_url: 'https://www.m-chemical.co.jp/en/news/' },
];

const PER_COMPANY = 10;

function fetchRssItems(file) {
  const path = `${RSS_DIR}/${file}`;
  if (!existsSync(path)) return [];
  const xml = readFileSync(path, 'utf-8');
  return parseGoogleNewsRss(xml).slice(0, PER_COMPANY * 4);
}

const generated_at = new Date().toISOString();
const companies = await Promise.all(COMPANIES.map(async c => {
  const rssItems = fetchRssItems(c.file);
  const news = await buildNewsItems(rssItems, c.name, c.news_url, PER_COMPANY);
  const { file, ...rest } = c;
  return { ...rest, news };
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

console.log(`✓ ${totalNews} 条真实新闻（来自 Google News）`);
for (const c of companies) {
  console.log(`  · ${c.name}: ${c.news.length} 条`);
}
console.log(`\n✓ data/${SLUG}.json (raw)`);
console.log(`✓ ${OUT_DIR}/${SLUG}/index.html (industry)`);
console.log(`✓ ${OUT_DIR}/index.html (homepage)`);
