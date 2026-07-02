#!/usr/bin/env node
// XPeng refill: xiaopeng.com/news (primary, 10 items) — no supplement needed
// Approved source: https://www.xiaopeng.com/news
//
// Note: xiaopeng.com/news renders 8 items on page 1 with a JS-driven "查看更多"
// (View More) button. We click it ~20 times to load the full archive, then hardcode the top 10.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/new-energy-vehicles-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'xpeng');

// 10 items from xiaopeng.com/news (top of desc-sorted list, captured via Chrome DOM scrape
// after clicking "查看更多" repeatedly; spot-checked URLs 5576 and 5568 are real articles)
const XPENG_NEWS = [
  { date: '2026-07-01T00:00:00Z', title: '小鹏集团联合东莞寮步公安开展系列反诈宣传，共筑全民反诈安全防线', url: 'https://www.xiaopeng.com/news/company_news/5576.html' },
  { date: '2026-06-24T00:00:00Z', title: '物理AI，链接全球！小鹏集团携物理AI全品类亮相第四届链博会', url: 'https://www.xiaopeng.com/news/company_news/5575.html' },
  { date: '2026-06-09T00:00:00Z', title: '小鹏集团再拓摩洛哥、突尼斯市场，北非"战略铁三角"成型', url: 'https://www.xiaopeng.com/news/company_news/5570.html' },
  { date: '2026-06-02T00:00:00Z', title: '小鹏集团受邀参加2026世界智能博览会', url: 'https://www.xiaopeng.com/news/company_news/5569.html' },
  { date: '2026-06-02T00:00:00Z', title: '小鹏集团5月共交付新车32,158台', url: 'https://www.xiaopeng.com/news/company_news/5568.html' },
  { date: '2026-06-02T00:00:00Z', title: 'AI改变世界：小鹏集团携物理AI全品类亮相2026粤港澳大湾区车展，彰显科技实力', url: 'https://www.xiaopeng.com/news/company_news/5567.html' },
  { date: '2026-06-02T00:00:00Z', title: '小鹏集团完成从智能电动车企到物理AI公司的蜕变：第二代VLA规模落地、Robotaxi量产下线、人形机器人年底量产同步推进', url: 'https://www.xiaopeng.com/news/company_news/5566.html' },
  { date: '2026-06-02T00:00:00Z', title: '小鹏集团发布2026年第一季度财报：毛利率维持20.6%高位，加速推动物理AI应用商业化', url: 'https://www.xiaopeng.com/news/company_news/5565.html' },
  { date: '2026-05-22T00:00:00Z', title: '中国首台全栈自研Robotaxi量产下线！小鹏GX为原型车，本地算力3000 TOPS全球最高', url: 'https://www.xiaopeng.com/news/company_news/5564.html' },
  { date: '2026-05-21T00:00:00Z', title: '用科技重新定义旗舰：小鹏GX正式上市，限时权益价26.98万元起', url: 'https://www.xiaopeng.com/news/company_news/5563.html' },
];

const now = new Date().toISOString();
c.news = XPENG_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date,
  fetched_at: now,
  source: 'xiaopeng.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('XPeng news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);