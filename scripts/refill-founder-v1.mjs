#!/usr/bin/env node
// Founder Motor (方正电机, SZ:002196) — 10 cninfo announcements.
// corp site (fdm.com.cn) JS shell; cninfo API only reliable source.
// orgId verified 2026-07-10 via topSearch API: 9900003913.
import { readFileSync, writeFileSync } from 'node:fs';
const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'founder');
const now = new Date().toISOString();
c.news_url = 'http://www.fdm.com.cn';
const N = [
  ['2026-06-24', 'finalpage/2026-06-25/1225386404.PDF', '关于公司部分董事及高级管理人员减持股份预披露公告'],
  ['2026-05-19', 'finalpage/2026-05-20/1225317054.PDF', '关于股票异动的公告'],
  ['2026-05-07', 'finalpage/2026-05-08/1225282471.PDF', '关于参加浙江辖区上市公司2026年投资者网上集体接待日暨2025年度业绩说明会的公告'],
  ['2026-05-07', 'finalpage/2026-05-08/1225282470.PDF', '关于董事会完成换届选举并聘任高级管理人员的公告'],
  ['2026-05-07', 'finalpage/2026-05-08/1225282469.PDF', '方正电机2025年年度股东会法律意见书'],
  ['2026-05-07', 'finalpage/2026-05-08/1225282468.PDF', '2025年年度股东会决议公告'],
  ['2026-05-07', 'finalpage/2026-05-08/1225282467.PDF', '公司第九届董事会第一次会议决议公告'],
  ['2026-04-14', 'finalpage/2026-04-15/1225102331.PDF', '内部控制规则落实自查表'],
  ['2026-04-14', 'finalpage/2026-04-15/1225102330.PDF', '2025年度董事会工作报告'],
  ['2026-04-14', 'finalpage/2026-04-15/1225102329.PDF', '2025年度总经理工作报告'],
];
c.news = N.map(([d, p, t]) => ({
  title: t, url: 'http://static.cninfo.com.cn/' + p,
  snippet: '', published_at: d + 'T00:00:00Z', fetched_at: now, source: 'cninfo.com.cn',
}));
c.fallback_news = [];
writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Founder Motor news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0,10), '|', n.title);