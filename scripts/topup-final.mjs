#!/usr/bin/env node
// Final-pass topup for the last few companies still below 10. Uses custom
// English/CN queries per company + broader trade press queries.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';
import { searchSogouWeChat } from '../src/lib/sogou-news.mjs';

const CUTOFF = new Date('2025-06-29T00:00:00Z');
const BLOCKED = /cninfo\.com\.cn|seekingalpha|markets\.businessinsider|stockanalysis|simplywall\.st|wallstreetzen|wisesheets|tipranks|investing\.com|yahoo\.com\/news|insidermonkey|newsfilter\.io|aastocks|fool\.com|nasdaq\.com\/article|finance\.yahoo|morningstar\.com/;

async function headOk(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD', redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return res.status >= 200 && res.status < 400;
  } catch { return false; }
}

async function getPageDate(url) {
  try {
    const res = await fetch(url, {
      method: 'GET', redirect: 'follow',
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const metaPatterns = [
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
      /<meta[^>]+name=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']datePublished["']/i,
      /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
    ];
    for (const re of metaPatterns) {
      const m = html.match(re);
      if (m) { const t = new Date(m[1]); if (!isNaN(t.getTime())) return t; }
    }
    const tm = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if (tm) { const t = new Date(tm[1]); if (!isNaN(t.getTime())) return t; }
    const jl = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (jl) { const t = new Date(jl[1]); if (!isNaN(t.getTime())) return t; }
    return null;
  } catch { return null; }
}

const TARGETS = {
  'semiconductor-industry/smic': {
    queries: ['SMIC Q2 2026', 'SMIC earnings 2025', '中芯国际 14nm 7nm 量产', '中芯国际 2026 业绩', 'SMIC 28nm capacity expansion'],
    domain: 'smic.com',
  },
  'thermal-materials-industry/mmm': {
    queries: ['3M company news 2026', '3M 2025 Q4 earnings', '3M Solventum spin off', '3M innovation announcement 2025'],
    domain: 'news.3m.com',
  },
  'composite-insulator-industry/abb': {
    queries: ['ABB motion news 2026', 'ABB electrification acquisition 2025', 'ABB robotics 2026', 'ABB e-mobility'],
  },
  'composite-insulator-industry/ztt': {
    queries: ['中天科技 海缆 2025', 'ZTT submarine cable 2025', '中天科技 储能 2026', 'ZTT optical fiber news'],
  },
  'composite-insulator-industry/teconnectivity': {
    queries: ['TE Connectivity 2026', 'TE Connectivity Q4 2025 earnings', 'TE Connectivity acquisition', 'TE Connectivity automotive'],
  },
  'composite-insulator-industry/hubbell': {
    queries: ['Hubbell Incorporated 2026', 'Hubbell earnings 2025', 'Hubbell electrical acquisition'],
  },
  'composite-insulator-industry/macleanfogg': {
    queries: ['Maclean Power Systems 2026', 'MacLean-Fogg acquisition 2025', 'Maclean-Fogg manufacturing news'],
  },
  'datacenter-cooling-industry/aurastw': {
    queries: ['Auras Technology 2026', '双鸿科技 散热 2025', 'Auras liquid cooling', '雙鴻科技 液冷'],
  },
  'datacenter-cooling-industry/caoe': {
    queries: ['China Aviation Optical 2026', '中航光电 2025', 'AVIC Optoelectronics 2025', '中航光电 连接器 2025'],
  },
  'datacenter-cooling-industry/coolit': {
    queries: ['CoolIT Systems 2026', 'CoolIT data center cooling 2025', 'CoolIT partnership NVIDIA', 'CoolIT CHIPS Act'],
  },
};

for (const [key, cfg] of Object.entries(TARGETS)) {
  const [slug, id] = key.split('/');
  const fp = join('data', `${slug}.json`);
  if (!existsSync(fp)) { console.log(`✗ ${id}: industry file missing`); continue; }
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const c = data.companies.find(x => x.id === id);
  if (!c) { console.log(`✗ ${id}: company missing`); continue; }
  const need = 10 - c.news.length;
  if (need <= 0) { console.log(`✓ ${id}: already at ${c.news.length}`); continue; }
  console.log(`\n▸ ${id} (${c.name}): have ${c.news.length}, need ${need}`);

  const seen = new Set(c.news.map(n => n.url));
  const candidates = [];

  for (const q of cfg.queries) {
    if (candidates.length >= need * 4) break;
    try {
      const r = await fetchBingNews(q, { maxResults: need * 2 });
      for (const x of r) {
        if (!x.url || BLOCKED.test(x.url) || seen.has(x.url)) continue;
        candidates.push(x);
      }
    } catch {}
    if (/[一-龥]/.test(q)) {
      try {
        const r = await searchSogouWeChat(q, { maxResults: need * 2 });
        for (const x of r) {
          if (!x.sogouUrl || seen.has(x.sogouUrl)) continue;
          candidates.push({ title: x.title, url: x.sogouUrl, source: 'weixin.sogou.com' });
        }
      } catch {}
    }
  }

  // Filter by relevance
  const nameLower = c.name.toLowerCase();
  const nameTokens = c.name.split(/[\s,，、/]+/).filter(t => t.length >= 2);
  const filtered = candidates.filter(x => {
    const t = (x.title || '').toLowerCase();
    return nameTokens.some(tk => t.includes(tk.toLowerCase()));
  });
  for (const x of filtered) seen.add(x.url);

  // Validate
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
    const toAdd = validated.slice(0, need).map(v => ({
      title: v.title, url: v.url, snippet: '',
      published_at: v._date ? v._date.toISOString() : (v.published_at || null),
      fetched_at: now,
      source: v.source || (() => { try { return new URL(v.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
    }));
    c.news = [...c.news, ...toAdd];
    writeFileSync(fp, JSON.stringify(data, null, 2));
    console.log(`  ✓ added ${toAdd.length}, total now ${c.news.length}`);
  } else {
    console.log(`  ✗ no recent results (candidates: ${candidates.length}, passed relevance: ${filtered.length})`);
  }
}

console.log('\n=== Done ===');
