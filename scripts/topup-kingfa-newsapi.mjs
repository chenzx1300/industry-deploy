#!/usr/bin/env node
// Try multiple Chinese news sources for Kingfa to get real news articles
// beyond cninfo announcements. Sources tried in order:
//   1. eastmoney news API (forums + research reports)
//   2. cls.cn (财联社) — direct fetching
//   3. Kingfa official site (already done — kept 3 items)

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CUTOFF = new Date('2025-06-29T00:00:00Z');

async function fetchEastmoneyNews(stockCode) {
  // Eastmoney's research/news API
  const url = `https://np-anotice-stock.eastmoney.com/api/security/ann?cb=&page_size=50&page_index=1&ann_type=A&client_source=web&stock_list=${stockCode}&f_node=0&s_node=0`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const j = await r.json();
    const items = (j.data?.list || []).map(it => {
      const date = new Date(it.notice_date + 'T00:00:00Z');
      return {
        title: (it.title_ch || it.title || '').replace(/^[^:]+:/, '').trim(),
        url: `https://data.eastmoney.com/notices/detail/${stockCode}/${it.art_code}.html`,
        published_at: date.toISOString(),
        source: 'eastmoney.com',
        category: it.columns?.[0]?.column_name || '',
      };
    }).filter(it => !isNaN(new Date(it.published_at).getTime()) && new Date(it.published_at) >= CUTOFF);
    return items;
  } catch { return []; }
}

async function fetchEastmoneyResearch(stockCode) {
  // 研报 (research reports) from eastmoney
  const url = `https://np-cnotice-stock.eastmoney.com/api/content/ann?cb=&page_size=50&page_index=1&ann_type=A&client_source=web&stock_list=${stockCode}&f_node=1`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.data?.list || []).slice(0, 30).map(it => ({
      title: (it.title || '').replace(/^[^:]+:/, '').trim(),
      url: `https://data.eastmoney.com/notices/detail/${stockCode}/${it.art_code}.html`,
      published_at: new Date(it.notice_date + 'T00:00:00Z').toISOString(),
      source: 'eastmoney.com',
    }));
  } catch { return []; }
}

async function fetchClsNews(keyword) {
  // 财联社 doesn't have a public API easily, skip
  return [];
}

const SLUG = 'thermal-materials-industry';
const fp = join('data', `${SLUG}.json`);
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'kingfa');
if (!c) { console.error('kingfa not found'); process.exit(1); }

console.log(`▸ ${c.name}: current ${c.news.length} items`);

// Try eastmoney for Kingfa (600143)
const em = await fetchEastmoneyNews('600143');
console.log(`  eastmoney announcements: ${em.length}`);

// Show categories to see if there's non-announcement news
const cats = {};
for (const it of em) cats[it.category] = (cats[it.category] || 0) + 1;
console.log('  categories:', cats);

// The current data has 10 items. We have 3 from official site + need 7 more.
// Strategy: prefer non-announcement categories (调研, ESG, etc.), but fill with announcements
const nonAnnouncement = em.filter(it => !/公告|分配|股票|股权|决议|担保|声明|减持|减持|调整/.test(it.title));
console.log(`  non-standard announcements: ${nonAnnouncement.length}`);

// Combine: existing 3 official site items + newer/older from cninfo/eastmoney
const existingUrls = new Set(c.news.map(n => n.url));
const candidates = em.filter(it => !existingUrls.has(it.url));
console.log(`  new candidates: ${candidates.length}`);

// Sort all 10 by date DESC
c.news.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
console.log('\n=== Current Kingfa items (sorted) ===');
for (const n of c.news) {
  console.log(`  [${n.published_at.slice(0,10)}] [${n.source}] ${n.title.slice(0,60)}`);
}