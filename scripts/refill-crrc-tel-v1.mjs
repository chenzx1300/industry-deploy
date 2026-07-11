#!/usr/bin/env node
// CRRC Times Electric (株洲中车时代电气, SH:688187) — 10 corp-site items
// from Chrome MCP scrape. Source: http://www.tec.crrczic.cc/1621.html
// (公司新闻, page 1, 22 items fetched 2026-07-11).
// Verified corp site renders fully in Chrome — no cninfo fallback needed.
// Top 10 by date desc with NEV-motor/power-electronics priority.
import { readFileSync, writeFileSync } from 'node:fs';
const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'crrc-tel');
const now = new Date().toISOString();
c.news_url = 'http://www.tec.crrczic.cc/1621.html';
const N = [
  ['2026-07-01', '1622-5316-6662.html', '中车时代电气助力合肥市轨道交通7号线一期开通运营'],
  ['2026-06-17', '1622-5316-6661.html', '中车时代电气为美加墨世界杯护航'],
  ['2026-06-12', '1622-5316-6659.html', '中车时代电气亮相PCIM Expo & Conference 2026'],
  ['2026-06-04', '1622-5316-6619.html', '北京鉴衡认证中心向公司460kW组串式光伏逆变器颁发认证证书'],
  ['2026-06-03', '1622-5316-6618.html', '中车时代电气新能源变流全场景方案亮相SNEC 2026'],
  ['2026-06-02', '1622-5316-6617.html', '公司研发的高频碳化硅辅助变流器迈入规模化推广阶段'],
  ['2026-05-28', '1622-5316-6616.html', '中国中车牵头制定的“机车车辆变压器”国际标准正式发布'],
  ['2026-05-27', '1622-5316-6615.html', '中国中车四度入选《财富》中国ESG影响力榜'],
  ['2026-05-15', '1622-5316-6614.html', '2026沙戈荒清洁能源大会 · 陕甘宁青分会圆满召开'],
  ['2026-05-13', '1622-5316-6613.html', '2102.01亿！中国中车稳居中国机械设备制造领域品牌价值榜首'],
];
c.news = N.map(([d, p, t]) => ({
  title: t,
  url: 'http://www.tec.crrczic.cc/s/' + p,
  snippet: '',
  published_at: d + 'T00:00:00Z',
  fetched_at: now,
  source: 'tec.crrczic.cc',
}));
c.fallback_news = [];
writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('CRRC Times Electric news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0,10), '|', n.title);
