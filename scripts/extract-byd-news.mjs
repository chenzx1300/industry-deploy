#!/usr/bin/env node
// Extract BYD news from bydglobal.com (new) + cninfo (fallback)
import { writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0';

async function fetchText(u, opts = {}) {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', ...(opts.headers || {}) },
        signal: AbortSignal.timeout(opts.timeout || 30000),
        redirect: 'follow',
      });
      return await r.text();
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

async function fetchBydNews() {
  const h = await fetchText('https://www.bydglobal.com/cn/NewsAndEvents/News.html', {
    headers: { 'Referer': 'https://www.bydglobal.com/cn/index.html' },
  });
  // Find the news list — links with /cn/news/YYYY-MM-DD/<id> followed by title and date
  const items = [];
  // The HTML uses <a href="...news/YYYY-MM-DD/ID">title</a> + date span
  const linkRe = /<a[^>]+href=[\"'](https:\/\/www\.bydglobal\.com\/cn\/news\/(\d{4})-(\d{2})-(\d{2})\/\d+)[\"'][^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = linkRe.exec(h))) {
    const url = m[1];
    const y = m[2], mo = m[3], d = m[4];
    const rawTitle = m[5].replace(/<[^>]+>/g, '').trim();
    const title = rawTitle.replace(/\s+/g, ' ');
    if (title.length < 6 || title.length > 200) continue;
    const date = `${y}-${mo}-${d}T00:00:00Z`;
    items.push({ url, title, date });
  }
  // Dedup by URL
  const seen = new Set();
  return items.filter(it => {
    if (seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });
}

async function fetchCninfoBusiness(code, orgId, column, n = 3) {
  // Get latest announcements, pick business-related ones (产销快报, 自愿公告, 年报, 季报)
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
  // Pick business ones
  const BIZ = /产销快报|自愿公告|年度报告|年报|季度报告|一季度|半年度|ESG|可持续发展|业绩/;
  const SKIP_GOV = /提名委员会|实施细则|议事规则|独立董事述职|股东大会决议|股东大会通知|关于召开|法律意见书|聘任会计师事务所|聘任公司|董事会议事|董事会决议/;
  const picked = [];
  for (const a of arr) {
    if (picked.length >= n) break;
    const title = a.announcementTitle;
    if (SKIP_GOV.test(title)) continue;
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

const bydNews = await fetchBydNews();
console.log('bydglobal.com news items:', bydNews.length);
for (const n of bydNews) console.log(' ', n.date.slice(0, 10), '|', n.title.slice(0, 50), '|', n.url);

const cninfo = await fetchCninfoBusiness('002594', 'gshk0001211', 'szse', 3);
console.log('\ncninfo business items:', cninfo.length);
for (const n of cninfo) console.log(' ', n.date.slice(0, 10), '|', n.title.slice(0, 50), '|', n.url);

// Combine, dedup, sort desc, cap at 10
const all = [...bydNews, ...cninfo];
const seen = new Set();
const merged = [];
for (const n of all.sort((a, b) => b.date.localeCompare(a.date))) {
  if (seen.has(n.url)) continue;
  seen.add(n.url);
  merged.push(n);
  if (merged.length >= 10) break;
}

console.log('\nFinal merged (cap 10):');
for (const n of merged) console.log(' ', n.date.slice(0, 10), '|', n.title);

writeFileSync('test/byd-news-raw.json', JSON.stringify(merged, null, 2));