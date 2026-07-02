#!/usr/bin/env node
// NIO refill: nio.cn/news (primary, 9 items page 1) — no SEC supplement needed
// Approved source: https://www.nio.cn/news

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/new-energy-vehicles-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'nio');

// 9 items from nio.cn/news (page 1, confirmed via browser snapshot)
const NIO_NEWS = [
  { date: '2026-07-01T00:00:00Z', title: '蔚来公司6月交付40,597台，同比增长62.9%', url: 'https://www.nio.cn/news/20260701001' },
  { date: '2026-06-22T00:00:00Z', title: '蔚来ES8完成第120,000台新车交付', url: 'https://www.nio.cn/news/20260622001' },
  { date: '2026-06-22T00:00:00Z', title: '蔚来先进制造新桥二工厂获评全球「灯塔工厂」', url: 'https://www.nio.cn/news/202606220012' },
  { date: '2026-06-09T00:00:00Z', title: '5月零售销量11,472台，蔚来全新ES8连续六个月斩获大型SUV销量冠军', url: 'https://www.nio.cn/news/20260609001' },
  { date: '2026-06-01T00:00:00Z', title: '蔚来公司5月交付37,705台，同比增长62.3%', url: 'https://www.nio.cn/news/20260601001' },
  { date: '2026-05-27T00:00:00Z', title: '售价49.8万元起，科技行政旗舰SUV蔚来ES9正式上市', url: 'https://www.nio.cn/news/20260527001' },
  { date: '2026-05-23T00:00:00Z', title: '开启交付245天，蔚来全新ES8完成第110,000台新车交付', url: 'https://www.nio.cn/news/20260523001' },
  { date: '2026-05-20T00:00:00Z', title: '蔚来公司发布2025年ESG报告', url: 'https://www.nio.cn/news/20260520001' },
  { date: '2026-05-18T00:00:00Z', title: '蔚来全新ES8成为2026 APEC 贸易部长会议主宾用车', url: 'https://www.nio.cn/news/20260518001' },
];

const now = new Date().toISOString();
c.news = NIO_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date,
  fetched_at: now,
  source: 'nio.cn',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('NIO news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);