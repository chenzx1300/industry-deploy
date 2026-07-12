#!/usr/bin/env node
// Bosom (本松新材 / 杭州本松新材料技术股份有限公司) refill — WeChat 公众号 source.
//
// User policy update 2026-07-12: Bosom's primary public-news channel is the
// official WeChat 公众号 "本松新材" (biz ID MzI2NjQ4NDUxOA==), not bosomchina.com
// (corp site news list is stale — last item 2025-09-08, beyond 12-month cutoff).
//
// Per user-provided WeChat articles (10 total collected 2026-07-12):
//   - All biz IDs verified as MzI2NjQ4NDUxOA== (nickname "本松新材")
//   - Per news-quality-policy.md (2026-07-11 revision): user-provided WeChat
//     links ARE accepted for verified official channels
//   - cninfo fallback does NOT apply (Bosom is NOT publicly traded —
//     ticker 688603 is Skychem, see [[bosom-feirongda-knowledge-base]])
//
// Source note: WeChat articles cannot be programmatically enumerated (profile_ext /
// cgi-bin/appmsg / appmsgalbum all return auth errors without WeChat session).
// Going forward, user will provide new article links manually; this script
// maintains the curated top-10 list.
//
// news_url stays as bosomchina.com (corp site, still works for "About" page)
// even though no new corp-site news exists; the actual article URLs come
// from mp.weixin.qq.com.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'bosom');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('Bosom not found in industries.json');

const now = new Date().toISOString();

// Approved news_url — keep as Bosom corp site (stays as company homepage link).
c.news_url = 'https://www.bosomchina.com/';

// Top 10 WeChat articles, sorted desc by create_time (extracted via Chrome MCP).
// Each row: [YYYY-MM-DDTHH:MM:SS, <mp.weixin.qq.com url>, <title>]
const BOSOM_NEWS = [
  ['2026-07-11T16:35:44', 'https://mp.weixin.qq.com/s/FcSWPNyBLtZ5YH03Oi7lEA', '燃青春，向未来！2026届青苗成长营一周高光回顾'],
  ['2026-07-10T10:30:00', 'https://mp.weixin.qq.com/s/fAX4OnEyQdjzjtt9QvHzzw', '交流互鉴，共促发展 | 华江科技与本松新材共话行业未来'],
  ['2026-07-07T10:30:00', 'https://mp.weixin.qq.com/s/V_tZaHp0MDCT7bjHcsGqCQ', '价值创造，共"塑"未来 | 本松新材2026届青苗成长营正式开营'],
  ['2026-07-04T01:00:00', 'https://mp.weixin.qq.com/s/jg-47hwwjDADc4hzydw8qw', '共话发展，同频共振｜本松新材迎来两批高校师生参观交流'],
  ['2026-06-10T08:12:35', 'https://mp.weixin.qq.com/s/pM60obkIx3nTrxR77Rog1Q', '直击CIME 2026 | 走进本松新材14H01展位，解锁多场景散热解决方案'],
  ['2026-06-08T12:17:50', 'https://mp.weixin.qq.com/s/gPGNLZ2zEmIxfp3IX3aSaw', '本松新材邀您共赴2026深圳导热散热及液冷技术展览会'],
  ['2026-06-06T12:45:00', 'https://mp.weixin.qq.com/s/j5TKryfhtoH_WVYJtFL4dw', '本松新材召开评优表彰大会'],
  ['2026-05-27T06:16:40', 'https://mp.weixin.qq.com/s/IU3sEdEjmOp3i2YUddgXQQ', '杭州市公检法司老同志前来本松参观考察'],
  ['2026-04-25T12:06:34', 'https://mp.weixin.qq.com/s/UsJS6QQiYnpinu4XTIw6ww', '本松新材与UL Solutions达成战略合作'],
  ['2026-04-15T02:43:38', 'https://mp.weixin.qq.com/s/GN2G2LN6l5FQCgT5e_fEMA', '本松新材邀您共赴2026国际橡塑展'],
];

c.news = BOSOM_NEWS.map(([d, url, t]) => ({
  title: t,
  url,
  snippet: '',
  published_at: d + 'Z',
  fetched_at: now,
  source: 'mp.weixin.qq.com',
}));

// Clear stale fallback_news from prior v1 (was 4 items incl. 展会动态 id-175)
c.fallback_news = [];

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Bosom news after refill:', c.news.length);
console.log('  news_url:', c.news_url);
console.log('  source:   mp.weixin.qq.com (user-provided WeChat, policy exempt 2026-07-11)');
for (const n of c.news) console.log(' ', n.published_at.slice(0, 19), '|', n.title);