#!/usr/bin/env node
// 会通新材料 Huitong (688219.SH) refill: 10 news items from orinko.com.cn
// (approved news_url), article links go to mp.weixin.qq.com (WeChat).
//
// User policy updated 2026-07-04: "我提供的就固化，可以把这个规则去掉"
// → for huitong, use orinko.com.cn listing + WeChat article URLs (per-user exception).
// The blanket "不要抓 mp.weixin.qq.com 链接" rule is REMOVED for this company only.
//
// Approved news_url: https://www.orinko.com.cn/news_index.html
// Pagination:        /news_index/p-<step*9>-9.html   (14 pages total, page 1 = latest)
// Article URL pattern: https://mp.weixin.qq.com/s/<slug>
//
// All 10 items extracted from page 1 via Chrome MCP on 2026-07-04.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'huitong');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('Huitong not found in industries.json');

const now = new Date().toISOString();

// news_url stays as approved: orinko.com.cn listing (page 1 latest).
c.news_url = 'https://www.orinko.com.cn/news_index.html';

// Top 10 most-recent items from page 1, hardcoded.
// Page 1 has ~11 items; we keep the top 10 by ReleaseDate desc.
const HUITONG_NEWS = [
  { date: '2026-05-18', url: 'https://mp.weixin.qq.com/s/H0EbKY-Ou4OSB7i1YvyqNw',     title: '通应用 | 一根管的"自白"：告别炸裂，看它如何重塑发动机的"呼吸道"' },
  { date: '2026-05-15', url: 'https://mp.weixin.qq.com/s/LQUAY9LDkYdyp1DOqirAxw',     title: 'CIBF2026完美收官，会通股份期待与您再相见！' },
  { date: '2026-03-12', url: 'https://mp.weixin.qq.com/s/yjYtBaCFTm7l7_2Ll2ifJg',     title: '创新材料 塑见未来 | 会通股份，邀您共赴一场可持续的材料科技之旅' },
  { date: '2026-03-12', url: 'https://mp.weixin.qq.com/s/TZO9a77-P72y6u5CK07oVA',     title: '实干笃行，向新而生 | 会通股份安庆基地年产30万吨高性能复合材料项目（二期工程）奠基仪式圆满落幕' },
  { date: '2026-03-09', url: 'https://mp.weixin.qq.com/s/jY_q8cYrWbj-WLiL9CJkow',     title: '同心聚力，共克时艰——致会通股份全体合作伙伴的一封信' },
  { date: '2026-02-24', url: 'https://mp.weixin.qq.com/s/uwgq5vcgZG_drOhRJOKiVQ',     title: '跃马深蓝，共赴星程 | 会通股份2026开工大吉，启航远征之路！' },
  { date: '2026-02-16', url: 'https://mp.weixin.qq.com/s/nPp5010x9kv5u627VHRiyw',     title: '跃马深蓝 共赴星程——会通股份董事长李健益 丙午马年贺词' },
  { date: '2026-02-06', url: 'https://mp.weixin.qq.com/s/56jiaUwAU072T3V_m9VFsA',     title: '韧性生长 深海远航 | 会通股份发布2026战略蓝图：以产品与效率穿越周期' },
  { date: '2026-02-05', url: 'https://mp.weixin.qq.com/s/COlduVxzloLkyIkgp9dP2A',     title: '深耕两载终破局！会通股份实现日本市场发货首突破！' },
  { date: '2026-01-24', url: 'https://mp.weixin.qq.com/s/bZQlMZguhlQ-uaDF5Czerg',     title: '会通环保控股会峰环境 深化绿色循环全产业链布局' },
];

c.news = HUITONG_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'orinko.com.cn',
}));

c.fallback_news = [];

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Huitong news after refill:', c.news.length);
console.log('  news_url:', c.news_url);
console.log('  policy:   WeChat links ALLOWED (user-approved exception 2026-07-04)');
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);