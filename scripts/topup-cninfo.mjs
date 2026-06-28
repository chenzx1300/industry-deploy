#!/usr/bin/env node
// Use cninfo.com.cn API to fetch announcements for A-share listed companies.
// For each company, look up orgId via topSearch, then query announcements.
//
// Usage: node scripts/topup-cninfo.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);

// Map company id -> { stockCode, column (sse/szse/bj) }
// sh=Shanghai, sz=Shenzhen
const COMPANY_TO_STOCK = {
  guangwei: { code: '300699', column: 'szse' },     // 光威复材 SZSE
  shenma: { code: '603530', column: 'sse' },         // 神马电力 SH
  dalian: { code: '002606', column: 'szse' },        // 大连电瓷 SZSE
  goldwind: { code: '002202', column: 'szse' },      // 金风科技 SZSE
  envicool: { code: '002837', column: 'szse' },      // 英维克 SZSE
  sugon: { code: '603019', column: 'sse' },          // 中科曙光 SH
  caoe: { code: '002179', column: 'szse' },          // 中航光电 SZSE
  feirongda: { code: '300602', column: 'szse' },     // 飞荣达 SZSE
  huitong: { code: '688219', column: 'sse' },        // 会通股份 SH STAR
};

async function lookupOrgId(code) {
  const r = await fetch('https://www.cninfo.com.cn/new/information/topSearch/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
    body: `keyWord=${code}&maxNum=10`,
  });
  const arr = await r.json();
  if (Array.isArray(arr) && arr.length > 0) return { orgId: arr[0].orgId, zwjc: arr[0].zwjc };
  return null;
}

async function fetchAnnouncements(code, orgId, column) {
  const body = `pageNum=1&pageSize=30&column=${column}&tabName=fulltext&plate=&stock=${code}%2C${orgId}&searchkey=&secid=&category=&trade=&seDate=&sortName=&sortType=&isHLtitle=true`;
  const r = await fetch('https://www.cninfo.com.cn/new/hisAnnouncement/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'Mozilla/5.0',
      'Accept': '*/*',
      'Origin': 'https://www.cninfo.com.cn',
      'Referer': 'https://www.cninfo.com.cn/',
    },
    body,
  });
  const j = await r.json();
  return j.announcements || [];
}

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));

for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  if (!existsSync(fp)) continue;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;

  for (const c of data.companies) {
    const stock = COMPANY_TO_STOCK[c.id];
    if (!stock) continue;
    if (c.news.length >= TARGET) continue;
    const need = TARGET - c.news.length;

    console.log(`\n▸ ${ind.slug}/${c.id} (${c.name}): have ${c.news.length}, need ${need}`);
    try {
      const info = await lookupOrgId(stock.code);
      if (!info) { console.log('  ✗ no orgId'); continue; }
      console.log(`  orgId=${info.orgId} (${info.zwjc})`);
      const anns = await fetchAnnouncements(stock.code, info.orgId, stock.column);
      const seen = new Set(c.news.map(n => n.url));
      const now = new Date().toISOString();
      let added = 0;
      for (const a of anns) {
        if (c.news.length >= TARGET) break;
        const url = `http://static.cninfo.com.cn/${a.adjunctUrl}`;
        if (seen.has(url)) continue;
        seen.add(url);
        const date = new Date(a.announcementTime).toISOString().slice(0, 10);
        c.news.push({
          title: a.announcementTitle,
          url,
          snippet: '',
          published_at: date + 'T00:00:00Z',
          fetched_at: now,
          source: 'cninfo.com.cn',
        });
        added++;
      }
      console.log(`  ✓ added ${added}`);
      touched = true;
    } catch (e) {
      console.log(`  ✗ error: ${e.message}`);
    }
  }

  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2));
}

console.log('\n=== Done ===');