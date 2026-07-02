#!/usr/bin/env node
// TSMC (台積電 2330.TW / TSM.US) refill: pr.tsmc.com/chinese/latest-news (10 items, hardcoded)
// Article URL pattern: /chinese/news/<numeric-id>
//
// Note: `?page=N` URL param doesn't paginate — page 0 has 10 items, page 1+ returns the same.
// 10 items is enough for our 10-cap.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'tsmc');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('TSMC not found in industries.json');

const now = new Date().toISOString();

// 10 most recent from /chinese/latest-news (page 0, 2026-06-10 → 2026-03-10)
const TSMC_NEWS = [
  { date: '2026-06-10', title: '台積公司 2026 年 5 月營收報告', url: 'https://pr.tsmc.com/chinese/news/3320' },
  { date: '2026-06-04', title: '台積公司股東常會決議', url: 'https://pr.tsmc.com/chinese/news/3317' },
  { date: '2026-05-15', title: '台積公司擬出售 8.1% 世界先進公司股權', url: 'https://pr.tsmc.com/chinese/news/3314' },
  { date: '2026-05-12', title: '台積公司董事會決議', url: 'https://pr.tsmc.com/chinese/news/3311' },
  { date: '2026-05-08', title: 'Sony 與台積公司初步達成下一世代影像感測器策略合作協議', url: 'https://pr.tsmc.com/chinese/news/3308' },
  { date: '2026-05-08', title: '台積公司 2026 年 4 月營收報告', url: 'https://pr.tsmc.com/chinese/news/3305' },
  { date: '2026-04-23', title: '台積公司舉辦 2026 年北美技術論壇 揭示 A13 製程技術', url: 'https://pr.tsmc.com/chinese/news/3302' },
  { date: '2026-04-16', title: '台積公司 2026 年第一季每股盈餘新台幣 22.08 元', url: 'https://pr.tsmc.com/chinese/news/3297' },
  { date: '2026-04-10', title: '台積公司 2026 年 3 月營收報告', url: 'https://pr.tsmc.com/chinese/news/3294' },
  { date: '2026-03-10', title: '台積公司 2026 年 2 月營收報告', url: 'https://pr.tsmc.com/chinese/news/3290' },
];

c.news = TSMC_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'pr.tsmc.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('TSMC news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);