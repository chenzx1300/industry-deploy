// Semiconductor industry build (one-shot, real RSS data).
// Invoke via industry-news-radar skill or directly: node scripts/build-semiconductor.mjs

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { parseGoogleNewsRss } from '../src/lib/rss-parser.mjs';
import { filterNewsItems } from '../src/lib/news-filter.mjs';
import { renderIndustryPage, renderHomepage } from '../src/pipeline/render.mjs';
import { addToManifest, loadManifest } from '../src/pipeline/manifest.mjs';

const SLUG = 'semiconductor-industry';
const PROMPT = '半导体';
const RSS_DIR = './tmp-rss-cache';
const DATA_DIR = 'data';
const OUT_DIR = 'docs';

const COMPANIES = [
  { id: 'huahong',   name: '华虹半导体 Hua Hong', region: 'cn',   domain: 'huahonggrace.com', file: 'huahong.xml',   monogram: '华', monogram_color: '#dc2626' },
  { id: 'ymtc',      name: '长江存储 YMTC',       region: 'cn',   domain: 'ymtc.com',        file: 'ymtc.xml',      monogram: '江', monogram_color: '#7c3aed' },
  { id: 'cxmt',      name: '长鑫存储 CXMT',       region: 'cn',   domain: 'cxmt.com',        file: 'cxmt.xml',      monogram: '存', monogram_color: '#0891b2' },
  { id: 'tsmc',      name: '台积电 TSMC',         region: 'intl', domain: 'tsmc.com',        file: 'tsmc.xml',      monogram: '台', monogram_color: '#cc0000' },
  { id: 'samsung',   name: '三星电子 Samsung',    region: 'intl', domain: 'samsung.com',     file: 'samsung.xml',   monogram: 'S', monogram_color: '#1428a0' },
  { id: 'intel',     name: 'Intel',               region: 'intl', domain: 'intel.com',       file: 'intel.xml',     monogram: 'I', monogram_color: '#0071c5' },
  { id: 'nvidia',    name: 'NVIDIA 英伟达',       region: 'intl', domain: 'nvidia.com',      file: 'nvidia.xml',    monogram: 'N', monogram_color: '#76b900' },
  { id: 'amd',       name: 'AMD',                 region: 'intl', domain: 'amd.com',         file: 'amd.xml',       monogram: 'A', monogram_color: '#ed1c24' },
  { id: 'qualcomm',  name: 'Qualcomm 高通',      region: 'intl', domain: 'qualcomm.com',    file: 'qualcomm.xml',  monogram: 'Q', monogram_color: '#3253dc' },
];

const PER_COMPANY = 10;

function fetchAndParse(file, companyName, maxItems) {
  const path = `${RSS_DIR}/${file}`;
  if (!existsSync(path)) return { items: [] };
  const xml = readFileSync(path, 'utf-8');
  const overFetch = maxItems * 4;
  const raw = parseGoogleNewsRss(xml).slice(0, overFetch);
  // Use direct_url (publisher homepage) instead of news.google.com redirect
  const items = raw.map(i => ({ ...i, url: i.direct_url || i.url }));
  const filtered = filterNewsItems(items, companyName).slice(0, maxItems);
  return { items: filtered };
}

const generated_at = new Date().toISOString();
const companies = COMPANIES.map(c => {
  const r = fetchAndParse(c.file, c.name, PER_COMPANY);
  const { file, ...rest } = c;
  return { ...rest, news: r.items };
});

const totalNews = companies.reduce((s, c) => s + c.news.length, 0);
console.log(`✓ ${totalNews} 条新闻分布在 ${companies.length} 家公司`);
for (const c of companies) console.log(`  · ${c.name}: ${c.news.length} 条`);

const data = { slug: SLUG, prompt: PROMPT, generated_at, companies, default_id: 'tsmc' };
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
console.log(`✓ docs/index.html (homepage, 3 industries)`);