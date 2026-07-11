#!/usr/bin/env node
// ZF Friedrichshafen (采埃孚) — 10 NEV-motor-relevant press releases.
// Source: press.zf.com/press/zh/press_database/press_database.html (Chinese press DB)
// Verified 2026-07-11 via Chrome MCP. Main zf.com 403s bots but press.zf.com works.
// Sorted by date desc. Items curated for NEV-motor relevance:
//   e-drive, ADAS/autonomous, brake-by-wire, steer-by-wire, transmission,
//   chassis sensors, China plant SOPs.
import { readFileSync, writeFileSync } from 'node:fs';
const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'zf');
const now = new Date().toISOString();
c.news_url = 'https://press.zf.com/press/zh/press_database/press_database.html?query=&start=0';
const N = [
  ['2026-02-10', 'releases/release_99392.html', '释放增长动能：采埃孚亚太区电驱动业务实现多项突破'],
  ['2026-02-06', 'releases/release_99008.html', '采埃孚与宝马达成前瞻传动技术合作'],
  ['2026-01-06', 'releases/release_97988.html', '采埃孚将底盘带入数字时代：CES首发AI道路感知系统'],
  ['2025-11-10', 'releases/release_96576.html', '采埃孚亚太创新日：多项尖端技术首发，引领智能电动出行'],
  ['2025-11-07', 'releases/release_92226.html', '采埃孚混动技术再升级：8HP evo变速器亮相慕尼黑车展'],
  ['2025-10-27', 'releases/release_95425.html', '采埃孚携手地平线首发最高至L3级coPILOT辅助驾驶系统'],
  ['2025-10-18', 'releases/release_95169.html', '加速在华智能出行布局 采埃孚制动系统新工厂正式投产'],
  ['2025-09-23', 'releases/release_93696.html', '采埃孚持续扩展本土转向系统产能，深化中国智能汽车战略布局'],
  ['2025-09-08', 'releases/release_92096.html', '慕尼黑车展：采埃孚展示软件定义底盘与电动化出行技术'],
  ['2025-08-13', 'releases/release_90944.html', '采埃孚张家港首个IPA稳定杆连接杆量产 轻量化创新启新篇'],
];
c.news = N.map(([d, p, t]) => ({
  title: t, url: 'https://press.zf.com/press/zh/' + p,
  snippet: '', published_at: d + 'T00:00:00Z', fetched_at: now, source: 'press.zf.com',
}));
c.fallback_news = [];
writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('ZF news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0,10), '|', n.title);