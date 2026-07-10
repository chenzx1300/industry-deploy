#!/usr/bin/env node
// CRRC Times Electric (株洲中车时代电气, SH:688187) — 10 cninfo announcements.
// corp site (tec.crrczic.cc) JS shell; cninfo API only reliable source.
// orgId verified 2026-07-10 via topSearch API: gshk0003898.
import { readFileSync, writeFileSync } from 'node:fs';
const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'crrc-tel');
const now = new Date().toISOString();
c.news_url = 'https://www.tec.crrczic.cc';
const N = [
  ['2026-07-06', 'finalpage/2026-07-07/1225411185.PDF', '株洲中车时代电气股份有限公司关于变更持续督导保荐代表人的公告'],
  ['2026-06-30', 'finalpage/2026-07-01/1225399329.PDF', 'H股公告'],
  ['2026-06-29', 'finalpage/2026-06-30/1225394634.PDF', '株洲中车时代电气股份有限公司关于核心技术人员变动的公告'],
  ['2026-06-26', 'finalpage/2026-06-27/1225392319.PDF', '株洲中车时代电气股份有限公司2025年年度股东会、2026年第一次A股类别股东会及2026年第一次H股类别股东会决议公告'],
  ['2026-06-26', 'finalpage/2026-06-27/1225392310.PDF', '株洲中车时代电气股份有限公司关于选举第八届职工董事的公告'],
  ['2026-06-26', 'finalpage/2026-06-27/1225392308.PDF', '株洲中车时代电气股份有限公司关于选举董事长、副董事长、董事会专门委员会成员及聘任高级管理人员、证券事务代表的公告'],
  ['2026-06-26', 'finalpage/2026-06-27/1225392307.PDF', '国浩律师（杭州）事务所关于株洲中车时代电气股份有限公司2025年年度股东会、2026年第一次A股类别股东会及2026年第一次H股类别股东会法律意见书'],
  ['2026-06-26', 'finalpage/2026-06-27/1225392121.PDF', 'H股公告'],
  ['2026-06-25', 'finalpage/2026-06-26/1225387912.PDF', 'H股公告'],
  ['2026-06-24', 'finalpage/2026-06-25/1225385646.PDF', 'H股公告'],
];
c.news = N.map(([d, p, t]) => ({
  title: t, url: 'http://static.cninfo.com.cn/' + p,
  snippet: '', published_at: d + 'T00:00:00Z', fetched_at: now, source: 'cninfo.com.cn',
}));
c.fallback_news = [];
writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('CRRC Times Electric news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0,10), '|', n.title);