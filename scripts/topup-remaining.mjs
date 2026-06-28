#!/usr/bin/env node
// Targeted topup for the remaining 14 companies below 10. Uses Bing News
// with English brand queries (more reliable than Chinese), validates every
// URL, falls back to Sogou WeChat for Chinese-only brands.
//
// Usage: node scripts/topup-remaining.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';
import { searchSogouWeChat } from '../src/lib/sogou-news.mjs';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);

const BLOCKED = /cninfo\.com\.cn|seekingalpha|markets\.businessinsider|stockanalysis|simplywall\.st|wallstreetzen|wisesheets|tipranks|investing\.com|yahoo\.com\/news|insidermonkey|newsfilter\.io|aastocks|fool\.com|nasdaq\.com\/article|finance\.yahoo/;

async function headOk(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
    });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

const TARGETS = {
  ymtc:        { slug: 'semiconductor-industry',         queries: ['YMTC Yangtze Memory', '长江存储 3D NAND'] },
  cxmt:        { slug: 'semiconductor-industry',         queries: ['CXMT ChangXin Memory', '长鑫存储 DRAM'] },
  nvidia:      { slug: 'semiconductor-industry',         queries: ['NVIDIA news', 'NVIDIA AI announcement'] },
  catl:        { slug: 'new-energy-vehicles-industry',   queries: ['CATL battery news', '宁德时代 电池'] },
  nio:         { slug: 'new-energy-vehicles-industry',   queries: ['NIO EV news', '蔚来汽车'] },
  toyota:      { slug: 'new-energy-vehicles-industry',   queries: ['Toyota news announcement'] },
  li:          { slug: 'new-energy-vehicles-industry',   queries: ['Li Auto news', '理想汽车'] },
  xpeng:       { slug: 'new-energy-vehicles-industry',   queries: ['XPeng Motors news', '小鹏汽车'] },
  henkel:      { slug: 'thermal-materials-industry',     queries: ['Henkel adhesive news'] },
  abb:         { slug: 'composite-insulator-industry',   queries: ['ABB grid news', 'ABB electrification'] },
  hubbell:     { slug: 'composite-insulator-industry',   queries: ['Hubbell electrical news', 'Hubbell Incorporated'] },
  macleanfogg: { slug: 'composite-insulator-industry',   queries: ['MacLean Power Systems news', 'Maclean-Fogg'] },
  avctw:       { slug: 'datacenter-cooling-industry',   queries: ['AVC cooling Taiwan', '奇鋐科技 散热'] },
  coolit:      { slug: 'datacenter-cooling-industry',   queries: ['CoolIT Systems liquid cooling'] },
};

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));

for (const [id, cfg] of Object.entries(TARGETS)) {
  const fp = join(DATA_DIR, `${cfg.slug}.json`);
  if (!existsSync(fp)) { console.log(`✗ ${id}: industry file missing`); continue; }
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const co = data.companies.find(c => c.id === id);
  if (!co) { console.log(`✗ ${id}: company missing`); continue; }

  const need = TARGET - co.news.length;
  if (need <= 0) { console.log(`✓ ${id}: already at ${co.news.length}`); continue; }
  console.log(`\n▸ ${id} (${co.name}): have ${co.news.length}, need ${need}`);

  const seen = new Set(co.news.map(n => n.url));
  const candidates = [];

  for (const q of cfg.queries) {
    if (candidates.length >= need * 3) break;
    try {
      const r = await fetchBingNews(q, { maxResults: need * 2 });
      for (const x of r) {
        if (!x.url || BLOCKED.test(x.url)) continue;
        if (seen.has(x.url)) continue;
        candidates.push({ title: (x.title || '').slice(0, 200), url: x.url, source: (() => { try { return new URL(x.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(), published_at: x.published_at || null });
      }
    } catch (e) {}
    // Sogou fallback for Chinese brands
    if (/[一-龥]/.test(q)) {
      try {
        const r = await searchSogouWeChat(q, { maxResults: need });
        for (const x of r) {
          if (!x.sogouUrl) continue;
          if (seen.has(x.sogouUrl)) continue;
          candidates.push({ title: (x.title || '').slice(0, 200), url: x.sogouUrl, source: 'weixin.sogou.com' });
        }
      } catch (e) {}
    }
  }

  console.log(`  candidates: ${candidates.length}`);

  const validated = [];
  const queue = [...candidates];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length && validated.length < need) {
      const cand = queue.shift();
      const ok = await headOk(cand.url);
      if (ok) validated.push(cand);
    }
  }));

  if (validated.length > 0) {
    const now = new Date().toISOString();
    const toAdd = validated.slice(0, need).map(v => ({
      title: v.title, url: v.url, snippet: '',
      published_at: v.published_at || null, fetched_at: now, source: v.source || '',
    }));
    co.news = [...co.news, ...toAdd];
    writeFileSync(fp, JSON.stringify(data, null, 2));
    console.log(`  ✓ added ${toAdd.length}, total now ${co.news.length}`);
  } else {
    console.log(`  ✗ no validated results`);
  }
}

console.log('\n=== Done ===');
