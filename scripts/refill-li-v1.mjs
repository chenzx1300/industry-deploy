#!/usr/bin/env node
// Li Auto refill: lixiang.com/news.html (primary, 10 items page 1) — no supplement needed
// Approved source: https://www.lixiang.com/news.html
//
// Note: lixiang.com returns 403 from sandbox fetch (Akamai WAF blocks non-browser UAs),
// but Chrome DevTools MCP renders it fine. So we hardcode the 10 items.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/new-energy-vehicles-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'li');

// 10 items from lixiang.com/news.html (page 1, confirmed via Chrome DOM scrape + 2 URL spot-checks)
const LI_NEWS = [
  { date: '2026-07-01T00:00:00Z', title: '理想汽车2026年6月交付30,895辆', url: 'https://www.lixiang.com/news/161.html' },
  { date: '2026-07-01T00:00:00Z', title: '全新理想L8正式发布', url: 'https://www.lixiang.com/news/172.html' },
  { date: '2026-06-01T00:00:00Z', title: '理想汽车2026年5月交付33,350辆', url: 'https://www.lixiang.com/news/160.html' },
  { date: '2026-05-15T00:00:00Z', title: '全新一代理想L9正式发布', url: 'https://www.lixiang.com/news/159.html' },
  { date: '2026-05-01T00:00:00Z', title: '理想汽车2026年4月交付34,085辆', url: 'https://www.lixiang.com/news/155.html' },
  { date: '2026-04-27T00:00:00Z', title: '理想汽车2026年3月交付41,053辆', url: 'https://www.lixiang.com/news/154.html' },
  { date: '2026-03-05T00:00:00Z', title: '理想汽车2026年2月交付26,421辆', url: 'https://www.lixiang.com/news/152.html' },
  { date: '2026-02-02T00:00:00Z', title: '理想汽车2026年1月交付27,668辆', url: 'https://www.lixiang.com/news/151.html' },
  { date: '2026-01-01T00:00:00Z', title: '理想汽车2025年12月交付44,246辆', url: 'https://www.lixiang.com/news/150.html' },
  { date: '2025-12-03T00:00:00Z', title: '理想AI眼镜 Livis 发布会', url: 'https://www.lixiang.com/news/149.html' },
];

const now = new Date().toISOString();
c.news = LI_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date,
  fetched_at: now,
  source: 'lixiang.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Li Auto news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);