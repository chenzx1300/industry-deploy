#!/usr/bin/env node
// Kingfa (金发科技 600143.SH) refill: 10 items, mix of on-site + cninfo fallback.
// On-site cadence is VERY slow (~1 article/year; most news redirects to mp.weixin.qq.com which we
// must skip per project policy). So per "如果太少，用股票公告信息来替代" we mix with cninfo.
//
// On-site source: kingfa.com.cn/portal/list/index/id/5.html (公司新闻)
// Article pattern: /portal/article/index/id/<numeric-id>/cid/5.html
// cninfo orgId: gssh0600143
// Footer: 粤ICP备05068754号

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'kingfa');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('Kingfa not found in industries.json');

const now = new Date().toISOString();

// 10 items: 1 on-site (newest) + 9 cninfo announcements (descending date, business-relevant)
const KINGFA_NEWS = [
  // #1 NEWEST — on-site only true business news in past year (verified ✅)
  { date: '2026-07-02', title: '供应链公司入选广东省首批制造业赋能资源名单', url: 'https://www.kingfa.com.cn/portal/article/index/id/9021/cid/5.html', source: 'kingfa.com.cn' },

  // cninfo announcements — desc date, business-relevant (skip 律师意见书 boilerplate)
  { date: '2026-07-02', title: '金发科技关于2026年6月为控股子公司提供担保的进展公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=600143&announcementId=1225403269', source: 'cninfo.com.cn' },
  { date: '2026-06-19', title: '金发科技2025年年度权益分派实施公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=600143&announcementId=1225379462', source: 'cninfo.com.cn' },
  { date: '2026-06-13', title: '金发科技2026年员工持股计划持有人第一次会议决议公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=600143&announcementId=1225367141', source: 'cninfo.com.cn' },
  { date: '2026-06-06', title: '金发科技2025年度可持续发展报告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=600143&announcementId=1225230178', source: 'cninfo.com.cn' },
  { date: '2026-06-02', title: '金发科技关于调整2025年度利润分配现金分红总额的公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=600143&announcementId=1225343638', source: 'cninfo.com.cn' },
  { date: '2026-05-30', title: '金发科技关于2026年限制性股票激励计划限制性股票授予结果公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=600143&announcementId=1225338017', source: 'cninfo.com.cn' },
  { date: '2026-05-21', title: '金发科技2025年年度股东会决议公告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=600143&announcementId=1225320352', source: 'cninfo.com.cn' },
  { date: '2026-04-29', title: '金发科技2025年度可持续发展报告摘要', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=600143&announcementId=1225229975', source: 'cninfo.com.cn' },
  { date: '2026-04-21', title: '金发科技2025年年度报告', url: 'http://www.cninfo.com.cn/new/disclosure/detail?stockCode=600143&announcementId=1225132815', source: 'cninfo.com.cn' },
];

c.news = KINGFA_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: n.source,
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Kingfa news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.source.padEnd(13), '|', n.title);