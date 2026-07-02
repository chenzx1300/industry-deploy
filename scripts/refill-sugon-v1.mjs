#!/usr/bin/env node
// Sugon (中科曙光 603019.SH) refill: sugon.com/about/news (10 items, hardcoded)
// News landing: https://www.sugon.com/about/news?time=0&category_id=1
// Article URL pattern: /cut?id=<numeric>&nav_id=48
// 78+ pages of news, page 1 has 16 items.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'sugon');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('Sugon not found in industries.json');

const now = new Date().toISOString();

// 10 most recent from /about/news (page 1, 2026-06-30 → 2026-06-04)
const SUGON_NEWS = [
  { date: '2026-06-30', title: '入选央国企数智化转型创新实践成果', url: 'https://www.sugon.com/cut?id=2917&nav_id=48' },
  { date: '2026-06-29', title: '中标！中科曙光斩获中国中车存储设备年度集采订单', url: 'https://www.sugon.com/cut?id=2915&nav_id=48' },
  { date: '2026-06-28', title: '央视《对话》｜中科曙光：夯实算力新基建，开辟太空新战场', url: 'https://www.sugon.com/cut?id=2913&nav_id=48' },
  { date: '2026-06-25', title: '一图看懂全球"双料冠军"存储产品', url: 'https://www.sugon.com/cut?id=2908&nav_id=48' },
  { date: '2026-06-24', title: '全球榜单双料第一！中科曙光再次登顶 IO500', url: 'https://www.sugon.com/cut?id=2906&nav_id=48' },
  { date: '2026-06-23', title: '中科曙光亮相欧洲，展示全球领先的中国 AI 基础设施方案', url: 'https://www.sugon.com/cut?id=2904&nav_id=48' },
  { date: '2026-06-16', title: '金融 AI 落地提速！中科曙光"元融"金融数智化解决方案正式发布', url: 'https://www.sugon.com/cut?id=2902&nav_id=48' },
  { date: '2026-06-12', title: '万卡集群时代，中科曙光 scaleFabric 重新定义高速互联', url: 'https://www.sugon.com/cut?id=2900&nav_id=48' },
  { date: '2026-06-09', title: '从"看天"到"算天"，中科曙光超智融合锚定 AI 气象现代化', url: 'https://www.sugon.com/cut?id=2898&nav_id=48' },
  { date: '2026-06-04', title: 'AIDC 迈入液冷时代，曙光数创四张先手牌锚定行业先机', url: 'https://www.sugon.com/cut?id=2896&nav_id=48' },
];

c.news = SUGON_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'sugon.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Sugon news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);