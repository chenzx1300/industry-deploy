#!/usr/bin/env node
// Final comprehensive fill + sort.
// 1. Auras 公告 from GOODINFO (TWSE 公告 aggregator) - hard-blocked everywhere else
// 2. Bing aggressive fill for other companies (yahoo hard-blocked)
// 3. cninfo for A-share
// 4. sort desc + clean at end

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);
const CUTOFF = new Date('2025-06-30T00:00:00Z');
const NOW = new Date().toISOString();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const AURAS_GOODINFO = 'https://goodinfo.tw/tw/StockAnnounceList.asp?STOCK_ID=3324';

const A_SHARE = {
  shenma: { code: '603530', column: 'sse' },
  dalian: { code: '002606', column: 'szse' },
  goldwind: { code: '002202', column: 'szse' },
  ztt: { code: '600522', column: 'sse' },
  envicool: { code: '002837', column: 'szse' },
  sugon: { code: '603019', column: 'sse' },
  caoe: { code: '002179', column: 'szse' },
  guangwei: { code: '300699', column: 'szse' },
  jushi: { code: '600176', column: 'sse' },
  sinofiber: { code: '688295', column: 'sse' },
  jlhx: { code: '000420', column: 'szse' },
  kingfa: { code: '600143', column: 'sse' },
  huitong: { code: '688219', column: 'sse' },
  feirongda: { code: '300602', column: 'szse' },
  bosom: { code: '688603', column: 'sse' },
  byd: { code: '002594', column: 'szse' },
  catl: { code: '300750', column: 'szse' },
  smic: { code: '688981', column: 'sse' },
};

const ALIASES = {
  toray: ['Toray Industries press', 'Toray Industries news', 'Toray 2026', '东丽 news', 'TORAY news', 'toray.com news'],
  henkel: ['Henkel AG press', 'Henkel news 2026', 'Henkel press release', 'Henkel adhesives', 'Henkel Beauty Care'],
  mmm: ['3M Company 2026', '3M quarterly earnings', '3M products news', '3M Science Applied'],
  vw: ['Volkswagen newsroom 2026', 'Volkswagen Group press', 'Volkswagen earnings 2026', 'VW Group news'],
  macleanfogg: ['MacLean-Fogg Company', 'MacLean Power Systems news', 'MacLean-Fogg press release', 'MacLean-Fogg acquisition'],
  coolit: ['CoolIT Systems press', 'CoolIT Systems announcement', 'CoolIT liquid cooling', 'CoolIT acquisition Ecolab'],
  ymtc: ['YMTC news 2026', '长江存储 2026', 'Yangtze Memory news', 'YMTC IPO', '长江存储 IPO'],
  cxmt: ['CXMT news 2026', '长鑫存储 2026', 'Changxin Memory news', 'CXMT IPO', 'CXMT HBM'],
  nio: ['NIO delivery update', 'NIO 2026 news', 'NIO Onvo', '蔚来 2026'],
  li: ['Li Auto delivery 2026', 'Li Auto news', '理想汽车 2026', 'Li Auto L series'],
};

const HARD_BLOCK = ['finance.yahoo.com', 'yahoo.com', 'weixin.sogou.com', 'cninfo.com.cn'];

function extractDate(text) {
  if (!text) return null;
  let m = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }
  m = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function isRelevant(title, aliases) {
  const lower = (title || '').toLowerCase();
  for (const a of (aliases || [])) {
    if (lower.includes(a.toLowerCase())) return true;
    if (/[一-龥]/.test(a) && lower.includes(a.slice(0, 2))) return true;
  }
  return false;
}

async function fetchPageDate(url) {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(7000), headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (!r.ok) return null;
    const html = await r.text();
    const mp = [/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,/<meta[^>]+name=["']datePublished["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']datePublished["']/i,/<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i];
    for (const re of mp) { const m = html.match(re); if (m) { const t = new Date(m[1]); if (!isNaN(t.getTime())) return t; } }
    const tm = html.match(/<time[^>]+datetime=["']([^"']+)["']/i); if (tm) { const t = new Date(tm[1]); if (!isNaN(t.getTime())) return t; }
    const jl = html.match(/"datePublished"\s*:\s*"([^"]+)"/); if (jl) { const t = new Date(jl[1]); if (!isNaN(t.getTime())) return t; }
    let d = extractDate(url);
    if (d) return d;
    return null;
  } catch { return null; }
}

function pushItem(c, it) {
  c.news.push({
    title: it.title,
    url: it.url,
    snippet: '',
    published_at: it.published_at,
    fetched_at: NOW,
    source: (() => { try { return new URL(it.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
  });
}

function dedupAdd(c, items) {
  const seen = new Set(c.news.map(n => n.url));
  let added = 0;
  for (const it of items) {
    if (c.news.length >= TARGET) break;
    if (!it.url || seen.has(it.url)) continue;
    const d = new Date(it.published_at);
    if (isNaN(d.getTime()) || d < CUTOFF) continue;
    seen.add(it.url);
    pushItem(c, it);
    added++;
  }
  return added;
}

async function fillBing(c) {
  const aliases = ALIASES[c.id];
  if (!aliases) return 0;
  const candidates = [];
  for (const q of aliases) {
    if (candidates.length >= 100) break;
    try {
      const r = await fetchBingNews(q, { maxResults: 20 });
      for (const x of r) candidates.push(x);
    } catch {}
  }
  const seenUrl = new Set();
  const filtered = [];
  for (const x of candidates) {
    if (!x.url || seenUrl.has(x.url)) continue;
    if (HARD_BLOCK.some(b => x.url.includes(b))) continue;
    if (!isRelevant(x.title || '', aliases)) continue;
    seenUrl.add(x.url);
    filtered.push(x);
  }
  const items = [];
  const CONC = 6;
  const queue = [...filtered];
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (queue.length) {
      const x = queue.shift();
      let d = null;
      if (x.published_at) { const t = new Date(x.published_at); if (!isNaN(t.getTime())) d = t; }
      if (!d) d = await fetchPageDate(x.url);
      if (!d) d = extractDate(x.title);
      if (!d) continue;
      if (d < CUTOFF) continue;
      items.push({ title: x.title, url: x.url, published_at: d.toISOString() });
    }
  }));
  const seen = new Set();
  const uniq = items.filter(x => {
    if (seen.has(x.url)) return false;
    seen.add(x.url);
    return true;
  });
  return dedupAdd(c, uniq);
}

async function lookupOrgId(code) {
  const r = await fetch('https://www.cninfo.com.cn/new/information/topSearch/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: `keyWord=${code}&maxNum=10`,
  });
  const arr = await r.json();
  if (Array.isArray(arr) && arr.length > 0) return { orgId: arr[0].orgId, zwjc: arr[0].zwjc };
  return null;
}

async function fetchAnnouncements(code, orgId, column) {
  const body = `pageNum=1&pageSize=50&column=${column}&tabName=fulltext&plate=&stock=${code}%2C${orgId}&searchkey=&secid=&category=&trade=&seDate=&sortName=&sortType=&isHLtitle=true`;
  const r = await fetch('https://www.cninfo.com.cn/new/hisAnnouncement/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': UA, 'Accept': '*/*', 'Origin': 'https://www.cninfo.com.cn', 'Referer': 'https://www.cninfo.com.cn/' },
    body,
  });
  const j = await r.json();
  return j.announcements || [];
}

async function fillAuras(c) {
  // Auras: only auras.com.tw/News/ + 公告 (from GOODINFO/TWSE)
  return fillTaiwanAnnouncements(c, 3324);
}

async function fillTaiwanAnnouncements(c, stockId) {
  // Taiwan 公告 from GOODINFO
  const items = [];
  try {
    const r = await fetch(`https://goodinfo.tw/tw/StockAnnounceList.asp?STOCK_ID=${stockId}`, { headers: { 'User-Agent': UA } });
    const html = await r.text();
    const re = stockId === 3017
      ? /<a[^>]+href=["'](StockAnnounceDetail\.asp\?STOCK_ID=3017[^"']*)["'][^>]*>([^<]{15,300})<\/a>/gi
      : /<a[^>]+href=["'](StockAnnounceDetail\.asp\?STOCK_ID=3324[^"']*)["'][^>]*>([^<]{15,300})<\/a>/gi;
    let m;
    const seen = new Set();
    while ((m = re.exec(html)) !== null) {
      const url = 'https://goodinfo.tw/tw/' + m[1];
      if (seen.has(url)) continue;
      seen.add(url);
      const title = m[2].replace(/\s+/g, ' ').trim();
      const dm = url.match(/CLAIM_TIME=(\d{4})%2F(\d{1,2})%2F(\d{1,2})/);
      if (dm) {
        const date = `${dm[1]}-${dm[2].padStart(2,'0')}-${dm[3].padStart(2,'0')}T00:00:00Z`;
        items.push({ title: '公告: ' + title.slice(0, 200), url, published_at: date });
      }
    }
  } catch {}
  return dedupAdd(c, items);
}

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));

for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  if (!existsSync(fp)) continue;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;

  for (const c of data.companies) {
    if (c.news.length >= TARGET) continue;
    const need = TARGET - c.news.length;
    console.log(`\n▸ ${ind.slug}/${c.id} (${c.name}): have ${c.news.length}, need ${need}`);

    let added = 0;
    // Auras special
    if (c.id === 'aurastw') {
      added += await fillAuras(c);
      console.log(`  auras 公告: +${added} (now ${c.news.length})`);
    }

    // AVCTW Taiwan 公告
    if (c.id === 'avctw') {
      added += await fillTaiwanAnnouncements(c, 3017);
      console.log(`  avctw 公告: +${added} (now ${c.news.length})`);
    }

    // A-share cninfo
    if (c.news.length < TARGET && A_SHARE[c.id]) {
      try {
        const info = await lookupOrgId(A_SHARE[c.id].code);
        if (info) {
          const anns = await fetchAnnouncements(A_SHARE[c.id].code, info.orgId, A_SHARE[c.id].column);
          const a = dedupAdd(c, anns.map(a => ({
            title: a.announcementTitle,
            url: `http://static.cninfo.com.cn/${a.adjunctUrl}`,
            published_at: new Date(a.announcementTime).toISOString().slice(0, 10) + 'T00:00:00Z',
          })));
          added += a;
          console.log(`  cninfo: +${a} (now ${c.news.length})`);
        }
      } catch {}
    }

    // Bing
    if (c.news.length < TARGET) {
      const a = await fillBing(c);
      added += a;
      console.log(`  bing: +${a} (now ${c.news.length})`);
    }

    if (added > 0) touched = true;
  }

  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2));
}

console.log(`\n=== Done ===`);
