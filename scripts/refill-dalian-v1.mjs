#!/usr/bin/env node
// Dalian Insulator (大连电瓷 002606.SZ) refill: insulators.cn (10 items, hardcoded)
// User provided source 2026-07-02: "大连电瓷 https://www.insulators.cn/news.html"
//
// insulators.cn is the REAL official site (footer: "版权所有©大连电瓷集团股份有限公司").
// Previous attempt used cninfo as fallback when dlpi.com.cn failed DNS — turned out
// insulators.cn was the correct domain all along. dlpi.com.cn is parked/broken.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'dalian');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('Dalian Insulator not found in industries.json');

const now = new Date().toISOString();

// 10 most recent items from insulators.cn/news.html (pages 1-2).
// Site pace is slow: latest item is 2026-04-23. Earlier items span to 2024-04-26.
const DALIAN_NEWS = [
  { date: '2026-04-23', title: '一图读懂丨大连电瓷2025年年报', url: 'https://www.insulators.cn/news_info/id-74.html' },
  { date: '2025-10-19', title: '跨越百年坚守初心 大连电瓷赋能电力新纪元——大连电瓷集团隆重举行110周年庆典', url: 'https://www.insulators.cn/news_info/id-71.html' },
  { date: '2025-09-12', title: '大连电瓷总经理应莹庭：从一座工厂，看百年绝缘子企业突围', url: 'https://www.insulators.cn/news_info/id-73.html' },
  { date: '2025-05-21', title: '大连电瓷集团股份有限公司与Union Power Company达成绝缘子领域合资合作', url: 'https://www.insulators.cn/news_info/id-72.html' },
  { date: '2025-05-15', title: '心系投资者，携手共行动~5.15全国投资者保护宣传日', url: 'https://www.insulators.cn/news_info/id-40.html' },
  { date: '2025-04-24', title: '一图读懂大连电瓷2024年度业绩', url: 'https://www.insulators.cn/news_info/id-4.html' },
  { date: '2025-04-24', title: '一图读懂大连电瓷2023年年度报告', url: 'https://www.insulators.cn/news_info/id-5.html' },
  { date: '2024-11-13', title: '证券时报专访大连电瓷董事长应坚：立足大连经开区 将产品送到五大洲电网', url: 'https://www.insulators.cn/news_info/id-61.html' },
  { date: '2024-04-30', title: '我公司制坯车间刘崇军同志，荣获2024"辽宁五一劳动奖章"', url: 'https://www.insulators.cn/news_info/id-62.html' },
  { date: '2024-04-26', title: '大连市机械行业协会成功组织完成科技成果鉴定会（特高压氟硅橡胶复合绝缘子）', url: 'https://www.insulators.cn/news_info/id-63.html' },
];

c.news = DALIAN_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'insulators.cn',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Dalian Insulator news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);