#!/usr/bin/env node
// BYD refill: bydglobal.com news (primary) + cninfo business (2-3 latest)
// Approved source: https://www.bydglobal.com/cn/NewsAndEvents/News.html
// Cninfo supplement only for: 产销快报, 自愿公告, 业绩公告 (NOT H股公告/治理类)

import { readFileSync, writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0';
const fp = 'data/new-energy-vehicles-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'byd');

// 8 items from bydglobal.com/cn/NewsAndEvents/News.html (confirmed via browser DOM scrape)
const BYD_NEWS = [
  { date: '2026-06-02T00:00:00Z', title: '比亚迪5月份销售383,453辆 海外销售突破16万辆，再创历史新高', url: 'https://www.bydglobal.com/cn/news/2026-06-02/1617162804707' },
  { date: '2026-05-29T00:00:00Z', title: '比亚迪率先承诺为城市领航安全兜底 发布中国首款4nm智驾芯片', url: 'https://www.bydglobal.com/cn/news/2026-05-29/1617162805514' },
  { date: '2026-05-27T00:00:00Z', title: '比亚迪成为第28届ANOC全体代表大会-2026年中国香港战略合作伙伴', url: 'https://www.bydglobal.com/cn/news/2026-05-27/1617162804277' },
  { date: '2026-05-15T00:00:00Z', title: '比亚迪荣登2026凯度BrandZ全球汽车品牌榜第五，连续四年蝉联全球汽车品牌前十', url: 'https://www.bydglobal.com/cn/news/2026-05-15/1617162800843' },
  { date: '2026-05-06T00:00:00Z', title: '比亚迪4月销售321,123辆，海外再创历史新高', url: 'https://www.bydglobal.com/cn/news/2026-05-06/1617162799743' },
  { date: '2026-04-22T00:00:00Z', title: '比亚迪第1600万辆新能源汽车下线 再铸就产业里程碑', url: 'https://www.bydglobal.com/cn/news/2026-04-22/1617162793219' },
  { date: '2026-04-02T00:00:00Z', title: '比亚迪3月份销售300,222辆，获得中国车企销量冠军', url: 'https://www.bydglobal.com/cn/news/2026-04-02/1617162791146' },
  { date: '2026-03-31T00:00:00Z', title: '比亚迪发布2025年ESG报告，积极履行可持续发展', url: 'https://www.bydglobal.com/cn/news/2026-03-31/1617162789425' },
];

async function fetchCninfoBusiness(code, orgId, column, n = 3) {
  const body = `pageNum=1&pageSize=30&column=${column}&tabName=fulltext&plate=&stock=${code}%2C${orgId}&searchkey=&secid=&category=&trade=&seDate=&sortName=&sortType=&isHLtitle=true`;
  const r = await fetch('https://www.cninfo.com.cn/new/hisAnnouncement/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': UA,
      'Origin': 'https://www.cninfo.com.cn',
      'Referer': 'https://www.cninfo.com.cn/',
    },
    body,
  });
  const j = await r.json();
  const arr = j.announcements || [];
  // Only true business-related (产销快报, 自愿公告), skip H股公告/治理
  const BIZ = /产销快报|自愿公告/;
  const picked = [];
  for (const a of arr) {
    if (picked.length >= n) break;
    const title = a.announcementTitle;
    if (!BIZ.test(title)) continue;
    const date = new Date(a.announcementTime).toISOString().slice(0, 10);
    picked.push({
      title,
      url: `http://static.cninfo.com.cn/${a.adjunctUrl}`,
      date: date + 'T00:00:00Z',
    });
  }
  return picked;
}

const cninfo = await fetchCninfoBusiness('002594', 'gshk0001211', 'szse', 2);
console.log('cninfo business items:', cninfo.length);
for (const n of cninfo) console.log(' ', n.date.slice(0, 10), '|', n.title);

const all = [...BYD_NEWS, ...cninfo];
const seen = new Set();
const merged = [];
for (const n of all.sort((a, b) => b.date.localeCompare(a.date))) {
  if (seen.has(n.url)) continue;
  seen.add(n.url);
  merged.push(n);
  if (merged.length >= 10) break;
}

const now = new Date().toISOString();
c.news = merged.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date,
  fetched_at: now,
  source: n.url.includes('cninfo.com.cn') ? 'cninfo.com.cn' : 'bydglobal.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('\nBYD news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);