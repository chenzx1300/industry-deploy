// One-off demo build: scrapes real news from each company's news center.
// No API keys required. Output goes to docs/.
// Usage: node demo-build.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildNewsItems } from './src/lib/news-scraper.mjs';
import { renderIndustryPage, renderHomepage } from './src/pipeline/render.mjs';
import { addToManifest, loadManifest } from './src/pipeline/manifest.mjs';

const SLUG = 'new-energy-vehicles-industry';
const PROMPT = '新能源汽车';
const DATA_DIR = 'data';
const OUT_DIR = 'docs';
const PER_COMPANY = 10;

// 6 EV head companies with curated news center URLs (real publishers)
const COMPANIES = [
  { id: 'byd',   name: '比亚迪 BYD',      region: 'cn',   domain: 'byd.com',        monogram: '比', monogram_color: '#dc2626', news_url: 'https://www.bydglobal.com/en/news.html' },
  { id: 'catl',  name: '宁德时代 CATL',   region: 'cn',   domain: 'catl.com',        monogram: '宁', monogram_color: '#0ea5e9', news_url: 'https://www.catl.com/en/' },
  { id: 'nio',   name: '蔚来 NIO',         region: 'cn',   domain: 'nio.com',         monogram: '蔚', monogram_color: '#059669', news_url: 'https://ir.nio.com/' },
  { id: 'tesla', name: 'Tesla 特斯拉',    region: 'intl', domain: 'tesla.com',       monogram: 'T', monogram_color: '#dc2626', news_url: 'https://www.tesla.com/blog' },
  { id: 'vw',    name: 'Volkswagen 大众', region: 'intl', domain: 'volkswagen.com',  monogram: 'V', monogram_color: '#1e40af', news_url: 'https://www.volkswagen-newsroom.com/en/press-releases' },
  { id: 'toyota',name: 'Toyota 丰田',     region: 'intl', domain: 'toyota.com',      monogram: 'T', monogram_color: '#b91c1c', news_url: 'https://global.toyota/en/newsroom/' },
];

const generated_at = new Date().toISOString();
const companies = await Promise.all(COMPANIES.map(async c => ({
  ...c,
  news: await buildNewsItems([], c.name, c.news_url, PER_COMPANY),
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