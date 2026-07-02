#!/usr/bin/env node
// JL Fiber (吉林化纤 000420.SZ) refill: cninfo fallback ONLY (jlhxjt.com persistently 504).
// As of 2026-07-03, the official site (jlhxjt.com, behind Tengine/Kunlun CDN) returns 504 Gateway
// Time-out on all requests (homepage + /news). The successful load (earlier in session) showed
// the news feed is dominated by provincial 政治 (时政要闻) + 习近平 articles, not company news.
// Per project policy "如果少于10条，用股票公告信息来替代" → use cninfo stock announcements.
//
// cninfo orgId: gssz0000420
// API: POST http://www.cninfo.com.cn/new/hisAnnouncement/query (GB2312-encoded titles)

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'jlhx');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('JL Fiber (jlhx) not found in industries.json');

const now = new Date().toISOString();

// 10 most relevant announcements from cninfo (mix: governance / business / quarterly / dividend)
const JLFIBER_NEWS = [
  { date: '2026-07-01', title: '吉林化纤股份有限公司关于召开2026年第一次临时股东会的通知', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=000420&announcementId=1225398693' },
  { date: '2026-07-01', title: '十一届八次董事会决议公告', url: 'http://www.cninfo.com.cn/new/disclosure/stock?stockCode=000420&orgId=gssz0000420' },
  { date: '2026-06-22', title: '吉林化纤股份有限公司获得政府补助的公告', url: 'http://www.cninfo.com.cn/new/disclosure/stock?stockCode=000420&orgId=gssz0000420' },
  { date: '2026-06-02', title: '关于实际控制人股权完成工商变更登记的公告', url: 'http://www.cninfo.com.cn/new/disclosure/stock?stockCode=000420&orgId=gssz0000420' },
  { date: '2026-05-29', title: '关于公司实际控制人变更的提示性公告', url: 'http://www.cninfo.com.cn/new/disclosure/stock?stockCode=000420&orgId=gssz0000420' },
  { date: '2026-05-23', title: '2025年年度股东会决议公告', url: 'http://www.cninfo.com.cn/new/disclosure/stock?stockCode=000420&orgId=gssz0000420' },
  { date: '2026-04-29', title: '2025年年度报告', url: 'http://www.cninfo.com.cn/new/disclosure/stock?stockCode=000420&orgId=gssz0000420' },
  { date: '2026-04-29', title: '2026年一季度报告', url: 'http://www.cninfo.com.cn/new/disclosure/stock?stockCode=000420&orgId=gssz0000420' },
  { date: '2026-04-29', title: '吉林化纤股份有限公司关于2025年度利润分配预案的公告', url: 'http://www.cninfo.com.cn/new/disclosure/stock?stockCode=000420&orgId=gssz0000420' },
  { date: '2026-04-29', title: '确认2025年日常关联交易和预计2026年日常关联交易的公告', url: 'http://www.cninfo.com.cn/new/disclosure/stock?stockCode=000420&orgId=gssz0000420' },
];

c.news = JLFIBER_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'cninfo.com.cn',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('JL Fiber news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);