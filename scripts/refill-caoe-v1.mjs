#!/usr/bin/env node
// CAOE (中航光电 002179.SZ) refill: jonhon.cn/News/news_list.htm (10 items, hardcoded)
// Note: industries.json's `domain: caoe.com.cn` was WRONG — actual site is jonhon.cn.
// Footer: "中航光电科技股份有限公司" + 豫ICP备09005130号 (Henan ICP).
//
// Article URL pattern: /News/news-detail-<numeric>.htm

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'caoe');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('CAOE not found in industries.json');

const now = new Date().toISOString();

// 10 most recent from /News/news_list.htm (page 1, 2026-05-22 → 2026-04-10)
// Skipped: 5.10 China Brand Day (WeChat link), 5.1 劳动节 (holiday PR), 4.20 经销商授权声明 (defensive PR)
const CAOE_NEWS = [
  { date: '2026-05-22', title: '互连新图景丨中航光电机器人智能无线充电组件，告别接线，高效补能', url: 'https://www.jonhon.cn/News/news-detail-7840.htm' },
  { date: '2026-05-15', title: '产品推荐丨中航光电盲插式 Manifold 产品：分液均衡，运维便捷，稳定可靠', url: 'https://www.jonhon.cn/News/news-detail-7839.htm' },
  { date: '2026-05-12', title: '产品推荐丨中航光电纳圆形系列连接器，助力电子通信设备小型化革新', url: 'https://www.jonhon.cn/News/news-detail-7838.htm' },
  { date: '2026-04-30', title: '全国汽标委电器分委会汽车线缆连接器标准工作组会议暨推荐性国家标准起草组启动会议暨汽车行业标准讨论会议成功召开', url: 'https://www.jonhon.cn/News/news-detail-7833.htm' },
  { date: '2026-04-28', title: '产品推荐丨中航光电新一代 Fakra 同轴连接器，创新结构加持，核心性能进阶', url: 'https://www.jonhon.cn/News/news-detail-7831.htm' },
  { date: '2026-04-25', title: '喜讯丨中航光电智能交流充电桩荣获2025年河南省工业设计大赛优秀奖', url: 'https://www.jonhon.cn/News/news-detail-7829.htm' },
  { date: '2026-04-14', title: '喜讯丨中航光电国标交直流一体式充电插座荣获"高品质充电"权威认证', url: 'https://www.jonhon.cn/News/news-detail-7818.htm' },
  { date: '2026-04-11', title: '展会直击丨中航光电走进中国国际医疗器械设计与制造技术展览会（ICMD）', url: 'https://www.jonhon.cn/News/news-detail-7819.htm' },
  { date: '2026-04-10', title: '展会直击丨中航光电走进大湾区国际液冷产业大会暨展览会（LCIE）', url: 'https://www.jonhon.cn/News/news-detail-7820.htm' },
  { date: '2026-04-20', title: '关于公司经销商授权情况的声明', url: 'https://www.jonhon.cn/News/news-detail-7827.htm' },
];

c.news = CAOE_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'jonhon.cn',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('CAOE news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);