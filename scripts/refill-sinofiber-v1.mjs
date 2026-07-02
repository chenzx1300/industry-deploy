#!/usr/bin/env node
// SinoFiber (中复神鹰 688295.SH) refill: zfsycf.com.cn/#/news/company (10 items hardcoded)
// Site uses hash routing (#/newsContent?id=N). News page: #/news/company.
// Article URL pattern: #/newsContent?id=<numeric-id>
//
// SinoFiber is a 中央企业 subsidiary of 中国建材集团, so news includes some 党建/安全/工会 internal items.
// Kept 10 most recent 公司动态 from page 1+2.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'sinofiber');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('SinoFiber not found in industries.json');

const now = new Date().toISOString();

const SINOFIBER_NEWS = [
  { date: '2026-06-28', title: '三条世界级产线集中投产！中国建材碳纤维全谱系产业化能力跃上新台阶', url: 'https://www.zfsycf.com.cn/#/newsContent?id=4363' },
  { date: '2026-06-18', title: '匠心砺技 自驱向新丨中复神鹰西宁公司职工在西宁市第二届职业技能大赛中斩获佳绩', url: 'https://www.zfsycf.com.cn/#/newsContent?id=4352' },
  { date: '2026-06-12', title: 'SAMPE 2026 | 中复神鹰"京"彩升级，闪耀盛会！', url: 'https://www.zfsycf.com.cn/#/newsContent?id=4354' },
  { date: '2026-06-05', title: '中复神鹰西宁公司创新实践入选"强根铸魂 非凡十年"国企党建案例', url: 'https://www.zfsycf.com.cn/#/newsContent?id=4358' },
  { date: '2026-06-04', title: '筑牢安全防线 护航高质量发展丨中联投资暨中复神鹰2026年"安全生产月"活动在西宁公司启动', url: 'https://www.zfsycf.com.cn/#/newsContent?id=4359' },
  { date: '2026-05-12', title: '获两项权威认可！中复神鹰ESG发展再上新台阶', url: 'https://www.zfsycf.com.cn/#/newsContent?id=4339' },
  { date: '2026-05-09', title: '高原铸"材"·匠心育"鹰"丨中复神鹰西宁公司产改实践入选"2026新时代企业深化产业工人队伍建设改革优秀案例"', url: 'https://www.zfsycf.com.cn/#/newsContent?id=4338' },
  { date: '2026-03-11', title: 'SYT80（T1200级）超高强度碳纤维全球首发！中国建材集团碳纤维技术实现重大超越', url: 'https://www.zfsycf.com.cn/#/newsContent?id=4288' },
  { date: '2025-07-21', title: '纵深合作 再攀高峰丨中复神鹰与金博股份签署框架合作协议', url: 'https://www.zfsycf.com.cn/#/newsContent?id=4125' },
  { date: '2025-07-18', title: '"碳"索未来 成就非凡 | 2025中复神鹰碳纤维应用交流活动成功举办', url: 'https://www.zfsycf.com.cn/#/newsContent?id=4121' },
];

c.news = SINOFIBER_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'zfsycf.com.cn',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('SinoFiber news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);