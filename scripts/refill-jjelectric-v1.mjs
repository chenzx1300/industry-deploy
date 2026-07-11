#!/usr/bin/env node
// JJ Electric (精进电动, SH:688280) — 10 cninfo announcements.
// corp site (jjecn.com) redirects to jjeglobal.com (verified 2026-07-11).
// corp site is a JS shell; cninfo API is the only reliable source.
// orgId verified 2026-07-10 via topSearch API: nssc1000348.
import { readFileSync, writeFileSync } from 'node:fs';
const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'jjelectric');
const now = new Date().toISOString();
c.news_url = 'http://www.jjeglobal.com/';
const N = [
  ['2026-07-03', 'finalpage/2026-07-04/1225409494.PDF', '致同会计师事务所（特殊普通合伙）关于精进电动科技股份有限公司2025年年报问询函的回复'],
  ['2026-07-03', 'finalpage/2026-07-04/1225409487.PDF', '华泰联合证券有限责任公司关于精进电动科技股份有限公司2025年年度报告的信息披露监管问询函回复的核查意见'],
  ['2026-07-03', 'finalpage/2026-07-04/1225409485.PDF', '精进电动科技股份有限公司关于收到上海证券交易所《关于对精进电动科技股份有限公司2025年年度报告的信息披露监管问询函》的回复公告'],
  ['2026-05-22', 'finalpage/2026-05-23/1225324857.PDF', '精进电动科技股份有限公司关于召开2025年年度暨2026年第一季度业绩说明会的公告'],
  ['2026-05-15', 'finalpage/2026-05-16/1225310038.PDF', '北京市竞天公诚律师事务所关于精进电动科技股份有限公司2025年年度股东会的法律意见书'],
  ['2026-05-15', 'finalpage/2026-05-16/1225310025.PDF', '精进电动科技股份有限公司2025年年度股东会决议公告'],
  ['2026-05-13', 'finalpage/2026-05-14/1225304617.PDF', '精进电动科技股份有限公司股票交易严重异常波动公告'],
  ['2026-05-06', 'finalpage/2026-05-07/1225279645.PDF', '精进电动科技股份有限公司股票交易严重异常波动公告'],
  ['2026-04-30', 'finalpage/2026-05-01/1225272875.PDF', '精进电动科技股份有限公司股票交易异常波动公告'],
  ['2026-04-28', 'finalpage/2026-04-29/1225233445.PDF', '精进电动科技股份有限公司2026年第一季度报告'],
];
c.news = N.map(([d, p, t]) => ({
  title: t, url: 'http://static.cninfo.com.cn/' + p,
  snippet: '', published_at: d + 'T00:00:00Z', fetched_at: now, source: 'cninfo.com.cn',
}));
c.fallback_news = [];
writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('JJ Electric news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0,10), '|', n.title);