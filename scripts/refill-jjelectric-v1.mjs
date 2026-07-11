#!/usr/bin/env node
// JJ Electric (精进电动, SH:688280) — 10 corp-site items from Chrome MCP scrape.
// Source: https://www.jjeglobal.com/news/2/ (pages 1+2+3, anchor #N pagination).
// Verified 2026-07-11 via Chrome MCP — all 10 entries scraped live from corp
// site (no cninfo fallback needed). Top 10 by date desc with NEV-motor-product
// + partnership + governance mix.
// Run: node scripts/refill-jjelectric-v1.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'jjelectric');
const now = new Date().toISOString();
c.news_url = 'https://www.jjeglobal.com/news/2/';
const N = [
  ['2026-06-30', '/news/183.html', '精进电动联手庆铃汽车，推出超级油冷三合一电驱桥，打造轻卡行业标杆'],
  ['2026-05-20', '/news/182.html', '精进电动率先推出三合一电驱系统 配套商用车电驱桥 新一代超级油冷电机技术 实现行业最高的持续功率比'],
  ['2026-03-03', '/news/179.html', '精进电动任命总经理 加强核心管理团队'],
  ['2026-02-16', '/news/178.html', '精进电动给您拜年了！祝您在马年，乘风势起，马力全开，满电驰骋，宏图大展！'],
  ['2026-02-13', '/news/177.html', '衷心感谢区委区政府的鼓励与支持。2026年，精进电动将以此为动力，笃行不怠，以实绩回报信任，以奋进不负期望!'],
  ['2026-01-24', '/news/176.html', '强强联合 共谋发展 | 精进电动科技股份有限公司董事长余平一行到访东风德纳车桥'],
  ['2025-12-31', '/news/175.html', '精进电动祝您新年快乐，万事如意！'],
  ['2025-12-22', '/news/174.html', '三连奖！精进电动获中国电源学会科技进步二等奖'],
  ['2025-11-27', '/news/171.html', '精进电动荣获2024年度北京市科学技术进步奖二等奖'],
  ['2025-11-25', '/news/170.html', '精进电动“电机电控二合一”配套轻卡电驱桥，能效大幅领先行业'],
];
c.news = N.map(([d, p, t]) => ({
  title: t,
  url: 'https://www.jjeglobal.com' + p,
  snippet: '',
  published_at: d + 'T00:00:00Z',
  fetched_at: now,
  source: 'jjeglobal.com',
}));
c.fallback_news = [];
writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('JJ Electric news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0,10), '|', n.title);
