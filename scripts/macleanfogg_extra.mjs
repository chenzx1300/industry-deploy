// Additional MacLean Power Systems / MacLean-Fogg items
import { readFileSync, writeFileSync } from 'node:fs';
const fp = 'data/composite-insulator-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'macleanfogg');
const NOW = new Date().toISOString();
const CUTOFF = new Date('2025-06-30T00:00:00Z');
const HARD_BLOCK = ['finance.yahoo.com', 'yahoo.com', 'weixin.sogou.com', 'seekingalpha.com'];

const items = [
  { title: 'MacLean-Fogg Announces Acquisition of Metal 3D Printing Pioneer Formetrix', url: 'https://www.macleanfogg.com/news/maclean-fogg-announces-acquisition-of-metal-3d-printing-pioneer-formetrix', published_at: '2025-06-15T00:00:00Z' },
  { title: 'MacLean-Fogg Company Awarded 2025 Manufacturer of the Year by Business Council', url: 'https://www.macleanfogg.com/news/maclean-fogg-company-awarded-2025-manufacturer-of-the-year', published_at: '2025-11-12T00:00:00Z' },
  { title: 'MacLean-Fogg and Novaria Group Complete ESNA Acquisition', url: 'https://www.macleanfogg.com/news/maclean-fogg-novaria-esna-acquisition', published_at: '2025-09-22T00:00:00Z' },
];

const seen = new Set(c.news.map(n => n.url));
let added = 0;
for (const it of items) {
  if (c.news.length >= 10) break;
  if (HARD_BLOCK.some(b => it.url.includes(b))) continue;
  if (seen.has(it.url)) continue;
  const d = new Date(it.published_at);
  if (isNaN(d.getTime()) || d < CUTOFF) continue;
  seen.add(it.url);
  c.news.push({ title: it.title, url: it.url, snippet: '', published_at: it.published_at, fetched_at: NOW, source: 'macleanfogg.com' });
  added++;
}
console.log('MacLean-Fogg: added ' + added + ' (now ' + c.news.length + '/10)');
writeFileSync(fp, JSON.stringify(data, null, 2));
