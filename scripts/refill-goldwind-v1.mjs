#!/usr/bin/env node
// Goldwind (金风科技 002202.SZ) refill: goldwind.com/cn/news/focus/ (10 items, hardcoded)
// User approved 2026-07-02: "https://www.goldwind.com/cn/news/这个是金风的" — landing page.
// Items live under /cn/news/focus/ sub-listing with pagination 1-6.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'goldwind');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('Goldwind not found in industries.json');

const now = new Date().toISOString();

// 10 most recent Goldwind news items from /cn/news/focus/ (page 1).
// Sorted desc by date. Skipped: 招聘澄清 (defensive PR) and 2025可持续发展报告 (publication, not news).
const GOLDWIND_NEWS = [
  { date: '2026-06-26', title: '金风科技完成越南朔庄海上风电项目首批机组交付', url: 'https://www.goldwind.com/cn/news/focus-1256569732925188096' },
  { date: '2026-06-23', title: '金风科技为沙特 PIF5 3GW 风电项目发运首批风电设备', url: 'https://www.goldwind.com/cn/news/focus-1254727911093725184' },
  { date: '2026-06-09', title: '金风科技在南美风电装机突破3GW', url: 'https://www.goldwind.com/cn/news/focus-1254740445016287232' },
  { date: '2026-06-03', title: '金风科技关于就欧盟委员会《外国补贴条例》调查提起司法诉讼的声明', url: 'https://www.goldwind.com/cn/news/focus-1246914787565314048' },
  { date: '2026-05-13', title: '金风科技荣登 2026 年《财富》中国 ESG 影响力榜', url: 'https://www.goldwind.com/cn/news/focus-1239882716955194368' },
  { date: '2026-05-11', title: '金风科技助力南水北调集团实现"水能融合"发展新模式', url: 'https://www.goldwind.com/cn/news/focus-1238900451743867904' },
  { date: '2026-05-06', title: '连续七年！金风科技再次入选新财富最佳上市公司榜单', url: 'https://www.goldwind.com/cn/news/focus-1238899928084962304' },
  { date: '2026-04-27', title: '金风科技与香港科技大学达成"AI 气象+新能源"战略合作', url: 'https://www.goldwind.com/cn/news/focus-1234556503030211584' },
  { date: '2026-04-01', title: '金风科技正式发布风储智联一体化解决方案（ESIE2026）', url: 'https://www.goldwind.com/cn/news/focus-1227223117278140416' },
  { date: '2026-03-30', title: '金风混塔，首入东南亚（泰国风电项目群首段浇筑）', url: 'https://www.goldwind.com/cn/news/focus-1227223656460153856' },
];

c.news = GOLDWIND_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'goldwind.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Goldwind news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);