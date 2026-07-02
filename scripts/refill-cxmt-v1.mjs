#!/usr/bin/env node
// CXMT (长鑫存储 / 长鑫科技集团股份有限公司) refill: cxmt.com/news.html
// Article URL pattern: /news/info_<id>.html  (e.g., info_95.html)
//
// CRITICAL: 长鑫存储 is NOT publicly traded (no cninfo orgId found for "长鑫" or "合肥长鑫").
// Therefore cninfo fallback does NOT apply. We use ONLY official site (page 1 = /news.html,
// page 2 = /news-2.html — only 9 + 5 = 14 total items).
//
// Per "如果少于10条，用股票公告信息来替代" — but since the company is unlisted, 10 items is the
// floor we can hit using official site content (page 1 newest 9 + page 2's most recent).

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'cxmt');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('CXMT not found in industries.json');

const now = new Date().toISOString();

// 10 items: 9 newest from page 1 + 1 from page 2 (info_84 — 国际论坛 debut, 2023-02-01)
const CXMT_NEWS = [
  { date: '2025-11-23', title: '长鑫存储亮相IC China，首次全面展示DDR5和LPDDR5X最新产品', url: 'https://www.cxmt.com/news/info_95.html' },
  { date: '2025-10-28', title: '长鑫存储宣布已量产LPDDR5X产品', url: 'https://www.cxmt.com/news/info_94.html' },
  { date: '2025-04-13', title: '长鑫成立北京地区科协 助力区域科技发展', url: 'https://www.cxmt.com/news/info_93.html' },
  { date: '2023-12-13', title: '长鑫科创班研学活动圆满收官', url: 'https://www.cxmt.com/news/info_92.html' },
  { date: '2023-11-28', title: '长鑫存储推出多款LPDDR5产品', url: 'https://www.cxmt.com/news/info_90.html' },
  { date: '2023-09-27', title: '长鑫存储与SEMI举办节能降碳研讨会', url: 'https://www.cxmt.com/news/info_89.html' },
  { date: '2023-09-06', title: '长鑫存储与合肥八中共建"长鑫科创班"', url: 'https://www.cxmt.com/news/info_88.html' },
  { date: '2023-02-01', title: '长鑫存储8Gb DDR4启动生产', url: 'https://www.cxmt.com/news/info_83.html' },
  { date: '2023-02-01', title: '长鑫存储首次亮相国际论坛', url: 'https://www.cxmt.com/news/info_84.html' },
  { date: '2023-01-05', title: '长鑫存储董事长担任全球半导体联盟董事会成员', url: 'https://www.cxmt.com/news/info_77.html' },
];

c.news = CXMT_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'cxmt.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('CXMT news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);