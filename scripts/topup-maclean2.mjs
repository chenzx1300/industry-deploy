import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';

const CUTOFF = new Date('2025-06-29T00:00:00Z');
const BLOCKED = /cninfo\.com\.cn|seekingalpha|markets\.businessinsider|stockanalysis|simplywall\.st|wallstreetzen|wisesheets|tipranks|investing\.com|yahoo\.com\/news|insidermonkey|newsfilter\.io|aastocks|fool\.com|nasdaq\.com\/article|finance\.yahoo|morningstar\.com/;

async function headOk(url) {
  try { const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } }); return r.status >= 200 && r.status < 400; } catch { return false; }
}
async function getPageDate(url) {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } });
    if (!r.ok) return null;
    const html = await r.text();
    const mp = [/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,/<meta[^>]+name=["']datePublished["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']datePublished["']/i,/<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i];
    for (const re of mp) { const m = html.match(re); if (m) { const t = new Date(m[1]); if (!isNaN(t.getTime())) return t; } }
    const tm = html.match(/<time[^>]+datetime=["']([^"']+)["']/i); if (tm) { const t = new Date(tm[1]); if (!isNaN(t.getTime())) return t; }
    const jl = html.match(/"datePublished"\s*:\s*"([^"]+)"/); if (jl) { const t = new Date(jl[1]); if (!isNaN(t.getTime())) return t; }
    return null;
  } catch { return null; }
}

const fp = join('data', 'composite-insulator-industry.json');
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'macleanfogg');
const need = 10 - c.news.length;
console.log(`▸ macleanfogg: have ${c.news.length}, need ${need}`);

const seen = new Set(c.news.map(n => n.url));
const candidates = [];
// Subsidiary brands that are still "about MacLean-Fogg" — OMCO Solar, Mallard Manufacturing
const queries = [
  'OMCO Solar tracker 2025', 'OMCO Solar 2026',
  'Mallard Manufacturing 2025', 'Mallard Manufacturing 2026',
  'Maclean-Fogg announcement 2025', 'Maclean-Fogg announcement 2026',
  'Maclean-Fogg Mundelein 2025', 'Maclean-Fogg expansion',
  'MacLean Power earnings 2025', 'MacLean Power Q3 2025',
  'MacLean Power Q4 2025', 'MacLean Power Systems revenue 2025',
];
for (const q of queries) {
  if (candidates.length >= need * 5) break;
  try {
    const r = await fetchBingNews(q, { maxResults: 8 });
    for (const x of r) {
      if (!x.url || BLOCKED.test(x.url) || seen.has(x.url)) continue;
      candidates.push(x);
    }
  } catch {}
}
console.log(`  candidates: ${candidates.length}`);

const filtered = candidates.filter(x => {
  const t = (x.title || '').toLowerCase();
  return t.includes('maclean') || t.includes('omco') || t.includes('mallard');
});
console.log(`  filtered: ${filtered.length}`);
for (const x of filtered) seen.add(x.url);

const validated = [];
const queue = [...filtered];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length && validated.length < need) {
    const cand = queue.shift();
    const ok = await headOk(cand.url);
    if (!ok) continue;
    let date = null;
    if (cand.published_at) { const t = new Date(cand.published_at); if (!isNaN(t.getTime())) date = t; }
    if (!date) date = await getPageDate(cand.url);
    if (date && date < CUTOFF) continue;
    validated.push({ ...cand, _date: date });
  }
}));

if (validated.length > 0) {
  const now = new Date().toISOString();
  const toAdd = validated.slice(0, need).map(v => ({ title: v.title, url: v.url, snippet: '', published_at: v._date ? v._date.toISOString() : (v.published_at || null), fetched_at: now, source: v.source || (() => { try { return new URL(v.url).hostname.replace(/^www\./, ''); } catch { return ''; } })() }));
  c.news = [...c.news, ...toAdd];
  writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`  ✓ added ${toAdd.length}, total now ${c.news.length}`);
} else {
  console.log(`  ✗ no recent (candidates: ${candidates.length}, relevant: ${filtered.length})`);
}
