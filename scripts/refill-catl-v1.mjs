#!/usr/bin/env node
// CATL refill: catl.com/news/ (primary, 9 items page 1) + cninfo business (1 latest)
// Approved source: https://www.catl.com/news/

import { readFileSync, writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0';
const fp = 'data/new-energy-vehicles-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'catl');

// 9 items from catl.com/news/ (page 1, confirmed via browser snapshot)
const CATL_NEWS = [
  { date: '2026-06-29T00:00:00Z', title: '宁德时代积极响应《动力和储能电池企业供应商账款支付规范倡议》', url: 'https://www.catl.com/news/10065.html' },
  { date: '2026-06-28T00:00:00Z', title: 'GECC从愿景到行动："全球能源循环经济联盟"及《电池可循环设计指南》正式启动', url: 'https://www.catl.com/news/10063.html' },
  { date: '2026-06-26T00:00:00Z', title: '宁德时代与中国节能再签战略合作协议', url: 'https://www.catl.com/news/10062.html' },
  { date: '2026-06-24T00:00:00Z', title: '首款搭载宁德时代电池的重载人形机器人上岗', url: 'https://www.catl.com/news/10053.html' },
  { date: '2026-06-23T00:00:00Z', title: '宁德时代发布全球首款实证型钠电储能场站解决方案', url: 'https://www.catl.com/news/10052.html' },
  { date: '2026-06-18T00:00:00Z', title: '宁德时代携手泉州交发集团，共建"交通+新能源"全域融合生态', url: 'https://www.catl.com/news/10031.html' },
  { date: '2026-06-13T00:00:00Z', title: '宁德时代成咪咕2026美加墨世界杯转播顶级战略合作伙伴', url: 'https://www.catl.com/news/9919.html' },
  { date: '2026-06-12T00:00:00Z', title: '宁德时代与厦门公交集团签署战略合作协议，共筑绿色交通新生态', url: 'https://www.catl.com/news/9918.html' },
  { date: '2026-06-05T00:00:00Z', title: '锂电行业首张！宁德时代获国家级碳足迹标识认证', url: 'https://www.catl.com/news/9917.html' },
];

// cninfo business — pick 1 latest non-stock-only announcement for CATL (300750)
async function fetchCninfoOne(code, orgId, column) {
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
  const BIZ = /产销快报|自愿公告|社会责任|可持续发展|ESG|绿色|科技创新债券|技术创新/;
  for (const a of arr) {
    const title = a.announcementTitle;
    if (!BIZ.test(title)) continue;
    const date = new Date(a.announcementTime).toISOString().slice(0, 10);
    return {
      title,
      url: `http://static.cninfo.com.cn/${a.adjunctUrl}`,
      date: date + 'T00:00:00Z',
    };
  }
  return null;
}

// Look up CATL orgId
async function lookupOrgId(code) {
  const r = await fetch('https://www.cninfo.com.cn/new/information/topSearch/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: `keyWord=${code}&maxNum=10`,
  });
  const arr = await r.json();
  if (Array.isArray(arr) && arr.length > 0) return arr[0].orgId;
  return null;
}

const orgId = await lookupOrgId('300750');
console.log('CATL orgId:', orgId);
const cninfoBiz = await fetchCninfoOne('300750', orgId, 'szse');
console.log('cninfo biz:', cninfoBiz ? `${cninfoBiz.date.slice(0,10)} | ${cninfoBiz.title}` : 'none');

const all = cninfoBiz ? [cninfoBiz, ...CATL_NEWS] : [...CATL_NEWS];
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
  source: n.url.includes('cninfo.com.cn') ? 'cninfo.com.cn' : 'catl.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('\nCATL news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);