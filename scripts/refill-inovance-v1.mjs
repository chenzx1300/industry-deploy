#!/usr/bin/env node
// Inovance (汇川技术, SZ:300124) — 10 cninfo announcements.
// corp site (inovance.com/portal/news/list?typeId=1) is a JS shell — verified
// 2026-07-11. cninfo API is the only reliable source. Governance/HR items
// only (same pattern as Nidec/Aisin).
// orgId verified 2026-07-10 via topSearch API: 9900012527.
import { readFileSync, writeFileSync } from 'node:fs';
const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'inovance');
const now = new Date().toISOString();
c.news_url = 'https://www.inovance.com/portal/news/list?typeId=1';
const N = [
  ['2026-07-01', 'finalpage/2026-07-01/1225402651.PDF', '关于回购公司股份的进展公告'],
  ['2026-06-03', 'finalpage/2026-06-03/1225348524.PDF', '关于深圳市汇川技术股份有限公司第七期股权激励计划相关价格调整的法律意见书'],
  ['2026-06-03', 'finalpage/2026-06-03/1225348523.PDF', '第六届董事会第十五次会议决议公告'],
  ['2026-06-03', 'finalpage/2026-06-03/1225348522.PDF', '关于调整第六期股权激励计划、第七期股权激励计划所涉权益工具回购价格、授予价格及行权价格的公告'],
  ['2026-06-03', 'finalpage/2026-06-03/1225348525.PDF', '关于深圳市汇川技术股份有限公司第六期股权激励计划相关价格调整的法律意见书'],
  ['2026-06-01', 'finalpage/2026-06-01/1225342278.PDF', '关于回购公司股份的进展公告'],
  ['2026-05-27', 'finalpage/2026-05-27/1225332956.PDF', '关于2025年年度权益分派实施后调整回购股份价格上限的公告'],
  ['2026-05-27', 'finalpage/2026-05-27/1225332955.PDF', '2025年年度权益分派实施公告'],
  ['2026-05-21', 'finalpage/2026-05-21/1225324209.PDF', '公司薪酬管理制度（2026年5月）'],
  ['2026-05-21', 'finalpage/2026-05-21/1225324208.PDF', '北京市康达（广州）律师事务所关于深圳市汇川技术股份有限公司2025年年度股东会的法律意见书'],
];
c.news = N.map(([d, p, t]) => ({
  title: t, url: 'http://static.cninfo.com.cn/' + p,
  snippet: '', published_at: d + 'T00:00:00Z', fetched_at: now, source: 'cninfo.com.cn',
}));
c.fallback_news = [];
writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Inovance news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0,10), '|', n.title);