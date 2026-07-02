#!/usr/bin/env node
// Shenma Electric (神马电力 603530.SH) refill: cninfo ONLY (no good official site)
// Reason: shenma.com.cn is a different IT company; correct corporate site is not publicly
//         accessible. Per user policy: "如果太少，用股票公告信息来替代" — fall back to cninfo.
//
// 6 business announcements + 4 stock-announcement fillers = 10 items.

import { readFileSync, writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0';
const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
// companies are nested under industries[].companies[]
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'shenma');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('Shenma not found in industries.json');

// Decode cninfo GB2312 title to UTF-8 (the API returns latin1-encoded GBK)
function decodeTitle(t) {
  try {
    return Buffer.from(t, 'latin1').toString('gbk');
  } catch {
    return t;
  }
}

// White list (business) — these are unambiguously 业务相关
const BIZ = /中标|合同|签约|订单|战略合作|项目|一季度报告|年度报告|半年报|三季度|财报|业绩说明会|全资子公司|提质增效|海外|出口|国家电网|南方电网|客户|供货|新品|发布|研发|试验|认证|投产|扩产|开工|奠基|工程|采购|基地|工厂|变压器|绝缘子|套管|复合|藏粤|电网|直流|特高压/;
// Skip list (purely governance — never use)
const SKIP = /股东大会决议|股东大会通知|控股股东.*质押|减持股份计划|议事规则|法律意见书|权益分派$|董事会议事|独立董事述职|审计委员会|提名委员会|实施细则|召开.*股东大会|股票期权注销|减资|注册资本|股票交易异常|股票上市|差异化权益分派.*法律|会计师事务所.*履职情况|会计师事务所选聘|章程$/;

async function fetchCninfo(code, orgId, column, startDate, endDate) {
  const body = `pageNum=1&pageSize=80&column=${column}&tabName=fulltext&plate=&stock=${code}%2C${orgId}&searchkey=&secid=&category=&trade=&seDate=${startDate}~${endDate}&sortName=&sortType=&isHLtitle=true`;
  const r = await fetch('http://www.cninfo.com.cn/new/hisAnnouncement/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': UA,
      'Origin': 'http://www.cninfo.com.cn',
      'Referer': 'http://www.cninfo.com.cn/',
    },
    body,
  });
  const j = await r.json();
  return j.announcements || [];
}

async function lookupOrgId(code) {
  const r = await fetch('http://www.cninfo.com.cn/new/information/topSearch/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: `keyWord=${code}&maxNum=10`,
  });
  const arr = await r.json();
  if (Array.isArray(arr) && arr.length > 0) return arr[0].orgId;
  return null;
}

const orgId = await lookupOrgId('603530');
console.log('Shenma orgId:', orgId);

const raw = await fetchCninfo('603530', orgId, 'sse', '2025-07-01', '2026-07-01');

// Categorize: business first, then stock-announcement fillers
const bizItems = [];
const fillerItems = [];
for (const a of raw) {
  const t = decodeTitle(a.announcementTitle);
  const dt = new Date(a.announcementTime).toISOString().slice(0, 10);
  const entry = {
    title: t,
    url: `http://static.cninfo.com.cn/${a.adjunctUrl}`,
    date: dt,
  };
  if (BIZ.test(t) && !SKIP.test(t)) {
    bizItems.push(entry);
  } else if (!SKIP.test(t)) {
    fillerItems.push(entry);
  }
}
bizItems.sort((a, b) => b.date.localeCompare(a.date));
fillerItems.sort((a, b) => b.date.localeCompare(a.date));

const merged = [...bizItems, ...fillerItems].slice(0, 10);
console.log(`\nBusiness: ${bizItems.length} | Filler: ${fillerItems.length} | Total: ${merged.length}`);

const now = new Date().toISOString();
c.news = merged.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'cninfo.com.cn',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('\nShenma news after refill:');
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);