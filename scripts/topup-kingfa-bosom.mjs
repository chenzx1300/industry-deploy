import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';
import { searchSogouWeChat } from '../src/lib/sogou-news.mjs';

const CUTOFF = new Date('2025-06-29T00:00:00Z');
const BLOCKED = /cninfo\.com\.cn|seekingalpha|markets\.businessinsider|stockanalysis|simplywall\.st|wallstreetzen|wisesheets|tipranks|investing\.com|yahoo\.com\/news|insidermonkey|newsfilter\.io|aastocks|fool\.com|nasdaq\.com\/article|finance\.yahoo|morningstar\.com/;

async function headOk(url) { try { const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } }); return r.status >= 200 && r.status < 400; } catch { return false; } }
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

async function tryOne(id, cfg) {
  const fp = join('data', `${cfg.slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const c = data.companies.find(x => x.id === id);
  const need = 10 - c.news.length;
  if (need <= 0) return;
  console.log(`\n▸ ${id} (${c.name}): have ${c.news.length}, need ${need}`);
  const seen = new Set(c.news.map(n => n.url));
  const candidates = [];
  for (const q of cfg.queries) {
    if (candidates.length >= need * 6) break;
    try { const r = await fetchBingNews(q, { maxResults: 15 }); for (const x of r) { if (!x.url || BLOCKED.test(x.url) || seen.has(x.url)) continue; candidates.push(x); } } catch {}
    if (/[一-龥]/.test(q)) { try { const r = await searchSogouWeChat(q, { maxResults: 10 }); for (const x of r) { if (!x.sogouUrl || seen.has(x.sogouUrl)) continue; candidates.push({ title: x.title, url: x.sogouUrl, source: 'weixin.sogou.com' }); } } catch {} }
  }
  console.log(`  candidates: ${candidates.length}`);
  const filtered = candidates.filter(x => {
    const t = (x.title || '').toLowerCase();
    return cfg.nameTokens.some(tk => t.includes(tk.toLowerCase()));
  });
  for (const x of filtered) seen.add(x.url);
  console.log(`  filtered: ${filtered.length}`);
  for (const x of filtered.slice(0, 5)) console.log('    -', (x.title || '').slice(0, 60), '|', (x.url || '').slice(0, 60));
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
      // For these B2B Chinese companies, accept undated items if we can't find a date
      // (we'll check that they're Sogou WeChat links to official-looking sources, or that they're the company's own site)
      if (date && date < CUTOFF) { console.log(`  skip old: ${cand.title.slice(0,40)} (${date.toISOString().slice(0,10)})`); continue; }
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

await tryOne('kingfa', {
  slug: 'thermal-materials-industry',
  nameTokens: ['金发', 'Kingfa', 'kingfa'],
  queries: ['金发科技 2026', '金发科技 新闻', 'Kingfa 2026', '金发科技 财报', '金发 半年报', '金发 公告', '金发 子公司', '金发科技 印度', '金发科技 海外', '金发科技 工厂', '金发科技 投资', '金发科技 项目', '金发 战略合作', '金发科技 绿色'],
});
await tryOne('bosom', {
  slug: 'thermal-materials-industry',
  nameTokens: ['本松', 'Bosom', 'bosom'],
  queries: ['本松新材 2026', '本松 新闻', '杭州本松', 'Bosom New Materials', '本松 复合材料', '本松 施耐德', '本松 浙江大学', '本松 博士后', '本松 工厂', '本松 IPO', 'Bosom 材料', '本松 展会', '杭州本松新材料'],
});
console.log('\n=== Done ===');
