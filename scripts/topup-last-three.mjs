#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';
import { searchSogouWeChat } from '../src/lib/sogou-news.mjs';

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

const TARGETS = {
  'mmm': { slug: 'thermal-materials-industry', queries: ['3M company 2026 news', '3M N95 respirator', '3M automotive news', '3M factory investment 2025', '3M 2026 outlook', '3M Solventum', '3M earnings Q1 2026'], nameTokens: ['3M'] },
  'macleanfogg': { slug: 'composite-insulator-industry', queries: ['Maclean Power Systems news 2025 2026', 'Maclean-Fogg acquisition 2025', 'Maclean-Fogg Pressed Metals', 'Maclean-Fogg engineering news'], nameTokens: ['maclean', 'maclean-fogg', 'maclean-fogg component'] },
  'caoe': { slug: 'datacenter-cooling-industry', queries: ['中航光电 连接器 2026', '中航光电 2025', '中航光电 营收 2025', 'AVIC Optoelectronics 2025 2026'], nameTokens: ['中航光电', 'AVIC'] },
};

for (const [id, cfg] of Object.entries(TARGETS)) {
  const fp = join('data', `${cfg.slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const c = data.companies.find(x => x.id === id);
  const need = 10 - c.news.length;
  if (need <= 0) continue;
  console.log(`\n▸ ${id} (${c.name}): have ${c.news.length}, need ${need}`);
  const seen = new Set(c.news.map(n => n.url));
  const candidates = [];
  for (const q of cfg.queries) {
    if (candidates.length >= need * 5) break;
    try { const r = await fetchBingNews(q, { maxResults: need * 3 }); for (const x of r) { if (!x.url || BLOCKED.test(x.url) || seen.has(x.url)) continue; candidates.push(x); } } catch {}
    if (/[一-龥]/.test(q)) { try { const r = await searchSogouWeChat(q, { maxResults: need * 2 }); for (const x of r) { if (!x.sogouUrl || seen.has(x.sogouUrl)) continue; candidates.push({ title: x.title, url: x.sogouUrl, source: 'weixin.sogou.com' }); } } catch {} }
  }
  const filtered = candidates.filter(x => {
    const t = (x.title || '').toLowerCase();
    return cfg.nameTokens.some(tk => t.includes(tk.toLowerCase()));
  });
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
}

console.log('\n=== Done ===');
