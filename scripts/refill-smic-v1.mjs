#!/usr/bin/env node
// SMIC (中芯国际 688981.SH / 0981.HK) refill: smics.com/site/news (10 items, hardcoded)
// Year filter: ?year=YYYY (2026, 2025, 2024, 2023).
// Article URL pattern: /site/news_read/<numeric-id>

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'smic');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('SMIC not found in industries.json');

const now = new Date().toISOString();

// 10 most recent from /site/news (combining ?year=2026 and ?year=2025).
// SMIC news is mostly financial earnings + ESG/charity, with some industry events.
const SMIC_NEWS = [
  { date: '2026-05-14', title: '中芯国际发布2026Q1财报，单季销售收入超25亿美元', url: 'https://www.smics.com/site/news_read/3719' },
  { date: '2026-03-26', title: '中芯国际发布2025年报，经营业绩再上新台阶', url: 'https://www.smics.com/site/news_read/3714' },
  { date: '2026-02-10', title: '中芯国际发布2025Q3财报，全年销售收入创新高', url: 'https://www.smics.com/site/news_read/3712' },
  { date: '2025-11-26', title: '开放创"芯"，成就未来：中芯国际参展2025成都ICCAD', url: 'https://www.smics.com/site/news_read/3692' },
  { date: '2025-11-13', title: '中芯国际发布2025Q3财报，产收规模实现新跨越', url: 'https://www.smics.com/site/news_read/3691' },
  { date: '2025-09-24', title: '中芯国际举办第三届四地联动公益活动', url: 'https://www.smics.com/site/news_read/3688' },
  { date: '2025-09-03', title: '中芯国际举行第十三届"芯肝宝贝计划"捐赠仪式', url: 'https://www.smics.com/site/news_read/3686' },
  { date: '2025-08-07', title: '中芯国际发布2025Q2财报，上半年销售收入同比增长22%', url: 'https://www.smics.com/site/news_read/3685' },
  { date: '2025-05-08', title: '中芯国际发布2025Q1财报，销售收入同比增长28.4%', url: 'https://www.smics.com/site/news_read/3676' },
  { date: '2025-04-08', title: '中芯国际2024年度ESG报告获评"五星级"', url: 'https://www.smics.com/site/news_read/3668' },
];

c.news = SMIC_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'smics.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('SMIC news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);