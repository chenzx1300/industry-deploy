#!/usr/bin/env node
// Targeted top-up for the 12 A-share companies whose cninfo announcements
// were stripped. Uses Sogou WeChat (CN-friendly) + Bing English + manual
// known URLs from each company's official news site. Validates every URL.
//
// Usage: node scripts/topup-a-shares.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { searchSogouWeChat } from '../src/lib/sogou-news.mjs';
import { fetchBingNews } from '../src/lib/bing-news.mjs';

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

// Map each company to (a) a list of confirmed official news URLs to seed the
// slot, and (b) a search query for Sogou/Bing fallback.
const TARGETS = {
  // datacenter-cooling
  sugon: {
    slug: 'datacenter-cooling-industry',
    queries: ['曙光数创 浸没式液冷', 'Sugon Liquid cooling', '中科曙光 液冷服务器'],
  },
  caoe: {
    slug: 'datacenter-cooling-industry',
    queries: ['中航光电 连接器', 'China Aviation Optical-Electrical Technology'],
  },
  // composite-insulator
  shenma: {
    slug: 'composite-insulator-industry',
    queries: ['神马电力 复合绝缘子', 'Shenma Electric composite insulator'],
  },
  goldwind: {
    slug: 'composite-insulator-industry',
    queries: ['Goldwind wind turbine', '金风科技 风电'],
  },
  dalian: {
    slug: 'composite-insulator-industry',
    queries: ['Dalian Insulator', '大连电瓷 绝缘子'],
  },
  ztt: {
    slug: 'composite-insulator-industry',
    queries: ['ZTT cable', '中天科技 海缆'],
  },
  // carbon-fiber
  sinofiber: {
    slug: 'carbon-fiber-industry',
    queries: ['中复神鹰 碳纤维', 'Sinofiber carbon fiber'],
  },
  guangwei: {
    slug: 'carbon-fiber-industry',
    queries: ['光威复材 碳纤维', 'Guangwei Composites'],
  },
  jlhx: {
    slug: 'carbon-fiber-industry',
    queries: ['吉林化纤 碳纤维', 'JL Fiber Jilin carbon'],
  },
  // thermal-materials
  feirongda: {
    slug: 'thermal-materials-industry',
    queries: ['飞荣达 散热', 'Feirongda FRD thermal'],
  },
  huitong: {
    slug: 'thermal-materials-industry',
    queries: ['会通股份 高分子', 'Huitong polymer'],
  },
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
    // Try Sogou first
    try {
      const r = await searchSogouWeChat(q, { maxResults: need * 2 });
      for (const x of r) {
        if (!x.sogouUrl) continue;
        if (BLOCKED.test(x.sogouUrl)) continue;
        if (seen.has(x.sogouUrl)) continue;
        candidates.push({ title: (x.title || '').slice(0, 200), url: x.sogouUrl, source: 'weixin.sogou.com' });
      }
    } catch (e) { console.log(`  sogou err: ${e.message}`); }
    // Then Bing
    try {
      const r = await fetchBingNews(q, { maxResults: need * 2 });
      for (const x of r) {
        if (!x.url || BLOCKED.test(x.url)) continue;
        if (seen.has(x.url)) continue;
        candidates.push({ title: (x.title || '').slice(0, 200), url: x.url, source: (() => { try { return new URL(x.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(), published_at: x.published_at || null });
      }
    } catch (e) { console.log(`  bing err: ${e.message}`); }
  }

  console.log(`  candidates: ${candidates.length}`);

  // Validate
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
