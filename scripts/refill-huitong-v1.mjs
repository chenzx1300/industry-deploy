#!/usr/bin/env node
// Huitong (会通新材料 688219.SH, Orinko Advanced Plastics) refill: cninfo fallback ONLY.
//
// On-site source (orinko.com.cn/news_index.html) has ALL article links redirect to mp.weixin.qq.com
// (WeChat) — must skip per project policy. So per "如果太少，用股票公告信息来替代" we use cninfo.
//
// cninfo orgId: 9900041353 (plate=shj, 上海科创板)

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'huitong');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('Huitong not found in industries.json');

const now = new Date().toISOString();

// 10 most business-relevant announcements from cninfo 688219 (cn orgId 9900041353)
// Mix: governance + acquisitions + shareholder returns + ESG + board changes
const HUITONG_NEWS = [
  { date: '2026-07-02', title: '会通新材料股份有限公司2026年第二次临时股东会决议公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=688219&announcementId=1225403305' },
  { date: '2026-07-02', title: '会通新材料股份有限公司关于回购注销公司2024年员工持股计划未解锁股份减资暨通知债权人的公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=688219&announcementId=1225403309' },
  { date: '2026-06-27', title: '会通新材料股份有限公司关于变更持续督导保荐代表人的公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=688219&announcementId=1225389675' },
  { date: '2026-06-13', title: '会通新材料股份有限公司2025年年度权益分派实施公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=688219&announcementId=1225367604' },
  { date: '2026-06-13', title: '会通新材料股份有限公司关于以集中竞价交易方式回购股份的预案', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=688219&announcementId=1225368013' },
  { date: '2026-06-13', title: '会通新材料股份有限公司关于公司董事长、总经理提议公司回购股份的公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=688219&announcementId=1225367988' },
  { date: '2026-06-13', title: '会通新材料股份有限公司关于员工持股计划第二个锁定期业绩考核指标部分达成暨锁定期届满的公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=688219&announcementId=1225367656' },
  { date: '2026-05-28', title: '会通新材料股份有限公司2025年年度股东会决议公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=688219&announcementId=1225333422' },
  { date: '2026-05-28', title: '会通新材料股份有限公司2025年环境、社会与公司治理（ESG）报告（英文版）', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=688219&announcementId=1225333259' },
  { date: '2026-05-15', title: '会通新材料股份有限公司关于董事及核心技术人员变动的公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=688219&announcementId=1225307106' },
];

c.news = HUITONG_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'cninfo.com.cn',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Huitong news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);