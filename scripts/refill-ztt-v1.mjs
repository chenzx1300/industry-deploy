#!/usr/bin/env node
// ZTT (中天科技 600522.SH) refill: ztt.cn news_list (primary, 10 items, ID-brute-forced)
// Approved source: https://www.ztt.cn/news_list.html?category_id=46
//
// Note: ztt.cn pagination is broken (page= URL param ignored, only shows 3 latest).
// ztt.com SSL issue (unrecognized name), zttgroup.com is English-only.
// We brute-force news IDs (53965 down) to fetch the 10 most recent items.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'ztt');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('ZTT not found in industries.json');

const now = new Date().toISOString();

// 8 items from ztt.cn/news/show-N.html (ID brute-forced from 53965 down) + 2 cninfo business items
// User 2026-07-02: "ZTT用 https://www.ztt.cn/news_list.html?category_id=46，然后加2~3条公告，cninfo"
const ZTT_NEWS = [
  { date: '2026-07-01T00:00:00Z', title: '"全国先进基层党组织"！中天科技党委获中共中央表彰', url: 'https://www.ztt.cn/news/show-53962.html' },
  { date: '2026-06-29T00:00:00Z', title: '全球首发！中天科技推出10尺交直流一体液冷储能系统', url: 'https://www.ztt.cn/news/show-53963.html' },
  { date: '2026-06-28T00:00:00Z', title: '支撑 "AI+制造"，中天科技开建南通首座"光电协同智算中心"', url: 'https://www.ztt.cn/news/show-53961.html' },
  { date: '2026-06-23T00:00:00Z', title: '"蓝海领航"！中天科技发布新一代16000T海缆敷设船', url: 'https://www.ztt.cn/news/show-53959.html' },
  { date: '2026-06-23T00:00:00Z', title: '软硬一体+AI驱动 中天科技智慧能碳一体机来了', url: 'https://www.ztt.cn/news/show-53958.html' },
  { date: '2026-06-22T00:00:00Z', title: '第四届链博会启幕 中天科技五大产业链解决方案展示前沿成果', url: 'https://www.ztt.cn/news/show-53957.html' },
  { date: '2026-06-22T00:00:00Z', title: '链博会首日 中天科技重磅发布17280芯超大芯数高密度光缆', url: 'https://www.ztt.cn/news/show-53956.html' },
  { date: '2026-06-17T00:00:00Z', title: 'Global Offshore Wind 2026，中天科技全序列海缆方案尽显场景化优势', url: 'https://www.ztt.cn/news/show-53954.html' },
  { date: '2026-06-06T00:00:00Z', title: '江苏中天科技股份有限公司关于中标互联网企业数据中心用耗材项目的公告', url: 'http://static.cninfo.com.cn/finalpage/2026-06-06/1225353680.PDF' },
  { date: '2026-04-25T00:00:00Z', title: '江苏中天科技股份有限公司2026年第一季度报告', url: 'http://static.cninfo.com.cn/finalpage/2026-04-25/1225177465.PDF' },
];

c.news = ZTT_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date,
  fetched_at: now,
  source: 'ztt.cn',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('ZTT news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);