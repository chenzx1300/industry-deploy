#!/usr/bin/env node
// Aisin Corporation (TSE:7259) refill: 10 news items from
// https://www.aisin.com/en/news/2026/
//
// CRITICAL: Aisin's English news feed is dominated by IR/governance (stock
// repurchases, tender offers, dividends, executive changes) — same shape as
// Nidec. NEV-motor-adjacent items do exist (AT/CVT/E-drive production for
// Toyota/Mazda, Mobility CVC fund) but are scattered. Top 10 by date desc
// mix all categories — Aisin publishes IR-only feeds on this URL.
//
// All 36 items on 2026 page extracted 2026-07-10 via Chrome MCP. Top 10
// most recent (2026-07-06 → 2026-05-20).

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'aisin');

const now = new Date().toISOString();

c.news_url = 'https://www.aisin.com/en/news/2026/';

const AISIN_NEWS = [
  { date: '2026-07-06', url: 'https://www.aisin.com/en/news/uploads/20260706_en.pdf', title: 'Notice Concerning the Status of Stock Repurchases' },
  { date: '2026-06-22', url: 'https://www.aisin.com/en/news/uploads/20260622_1630_En.pdf', title: 'Notice Concerning Completion Disposal of Treasury Stock as Restricted Stock Compensation' },
  { date: '2026-06-19', url: 'https://www.aisin.com/en/news/2026/010660.html', title: 'Notice Regarding the Executive Structure' },
  { date: '2026-06-19', url: 'https://www.aisin.com/en/news/2026/010659.html', title: 'Results of the 103rd Ordinary General Meeting of Shareholders' },
  { date: '2026-06-11', url: 'https://www.aisin.com/en/news/2026/010650.html', title: 'AISIN Unveils Newly Renovated "History Zone" at the com-center on June 22' },
  { date: '2026-06-04', url: 'https://www.aisin.com/en/news/uploads/20260604_e.pdf', title: 'Notice Concerning the Status of Stock Repurchases' },
  { date: '2026-06-02', url: 'https://www.aisin.com/en/news/uploads/20260602_e.pdf', title: 'Notice Concerning Results of Tender Offer for Own Shares' },
  { date: '2026-05-26', url: 'https://www.aisin.com/en/news/2026/010638.html', title: '190,000 School Meals Donated to Children in Developing Countries through TABLE FOR TWO Activities in FY2025' },
  { date: '2026-05-20', url: 'https://www.aisin.com/en/news/uploads/20260520_en.pdf', title: 'Notice Concerning Disposal of Treasury Stock as Restricted Stock Compensation' },
  { date: '2026-05-20', url: 'https://www.aisin.com/en/news/2026/010630.html', title: 'AISIN to Exhibit at Automotive Engineering Exposition 2026' },
];

c.news = AISIN_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'aisin.com',
}));

c.fallback_news = [];

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Aisin news after refill:', c.news.length);
console.log('  news_url:', c.news_url);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);