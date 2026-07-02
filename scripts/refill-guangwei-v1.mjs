#!/usr/bin/env node
// Guangwei (光威复材 300699.SZ) refill: gwcfc.cn/news/64/<page>.aspx (10 items hardcoded)
// Article URL pattern: /news/show-<numeric-id>.aspx
// Pagination: /news/64/2.aspx (page 1 = /news/64.aspx, page 2 = /news/64/2.aspx)

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'guangwei');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('Guangwei not found in industries.json');

const now = new Date().toISOString();

const GUANGWEI_NEWS = [
  { date: '2026-06-18', title: '上工飞人碳纤维复材及轻型飞机制造项目顺利开工奠基', url: 'https://www.gwcfc.cn/news/show-419.aspx' },
  { date: '2026-06-17', title: '喜报｜光威复材科技获评威海市绿色工厂！', url: 'https://www.gwcfc.cn/news/show-418.aspx' },
  { date: '2026-06-15', title: '学习先辈攻坚事迹，厚植实业爱国情怀｜光威复材开展陈光威事迹专题授课活动', url: 'https://www.gwcfc.cn/news/show-413.aspx' },
  { date: '2026-06-10', title: '相约SAMPE 2026｜光威复材诚邀各界共探复材产业新机遇', url: 'https://www.gwcfc.cn/news/show-414.aspx' },
  { date: '2026-06-04', title: '光威复材董事长卢钊钧带队访问中船七二五所', url: 'https://www.gwcfc.cn/news/show-411.aspx' },
  { date: '2026-05-25', title: '喜报！威海拓展团队上榜第27届山东青年五四奖章集体名单', url: 'https://www.gwcfc.cn/news/show-396.aspx' },
  { date: '2026-05-23', title: '航空工业"领航"学术论坛暨第五届航空先进材料技术发展研讨会成功召开', url: 'https://www.gwcfc.cn/news/show-416.aspx' },
  { date: '2026-05-21', title: '陈光威同志先进事迹首场宣讲报告会举行', url: 'https://www.gwcfc.cn/news/show-417.aspx' },
  { date: '2026-05-06', title: '喜报！光威复材荣获中国航发航材院2025年度最佳质量奖', url: 'https://www.gwcfc.cn/news/show-409.aspx' },
  { date: '2026-05-04', title: '内蒙古光威碳纤田源获评九原区劳动模范！', url: 'https://www.gwcfc.cn/news/show-408.aspx' },
];

c.news = GUANGWEI_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'gwcfc.cn',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Guangwei news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);