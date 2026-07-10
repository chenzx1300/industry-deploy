#!/usr/bin/env node
// Nidec Corporation (TSE:6594) refill: 10 news items from
// https://www.nidec.com/en/corporate/news/
//
// CRITICAL: Nidec's only listing page is corporate/news/ — all 2026 items
// are governance/IR (人事/财报延期/股东会/质控/调查委员会). This is Nidec's
// public-disclosure record for 2026 (third-party investigation, ransomware,
// TSE listing violation penalty). Hardcoded per user policy: hardcoded lists
// are source of truth.
//
// All 40+ items extracted 2026-07-10 via Chrome MCP. Top 10 most recent
// (2026-06-30 → 2026-06-12).

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'nidec');

const now = new Date().toISOString();

c.news_url = 'https://www.nidec.com/en/corporate/news/';

const NIDEC_NEWS = [
  { date: '2026-06-30', url: 'https://www.nidec.com/files/user/www-nidec-com/corporate/news/2026/0630-02/260630-02en.pdf', title: 'Notice Regarding Personnel Changes' },
  { date: '2026-06-30', url: 'https://www.nidec.com/files/user/www-nidec-com/corporate/news/2026/0630-01/260630-01en.pdf', title: 'Notice Regarding Approval of an Extension of the Filing Deadline of Annual Securities Report for the 53rd Fiscal Year (Ended March 31, 2026)' },
  { date: '2026-06-29', url: 'https://www.nidec.com/files/user/www-nidec-com/corporate/news/2026/0629-03/260629-03en.pdf', title: 'Notice Regarding Filing of an Application for Approval of an Extension of the Filing Deadline of Annual Securities Report for the 53rd Fiscal Year (Ended March 31, 2026)' },
  { date: '2026-06-24', url: 'https://www.nidec.com/files/user/www-nidec-com/corporate/news/2026/0624-01/260624-01en.pdf', title: 'Initial Report on Ransomware-caused Damage to an Overseas Subsidiary of Nidec Corporation' },
  { date: '2026-06-18', url: 'https://www.nidec.com/files/user/www-nidec-com/corporate/news/2026/0618-03/260618-03en.pdf', title: 'Greeting Letter' },
  { date: '2026-06-18', url: 'https://www.nidec.com/files/user/www-nidec-com/corporate/news/2026/0618-02/260618-02en.pdf', title: 'Announcement Regarding the Board and Committee Structure of New Nidec' },
  { date: '2026-06-18', url: 'https://www.nidec.com/files/user/www-nidec-com/corporate/news/2026/0618-01/260618-01en.pdf', title: 'Notice of Resolutions at the 53rd Regular General Meeting of Shareholders' },
  { date: '2026-06-16', url: 'https://www.nidec.com/files/user/www-nidec-com/corporate/news/2026/0616-01/260616-01en.pdf', title: 'Notice regarding consideration of an application for approval of an extension of the filing deadline of Annual Securities Report for the 53rd Fiscal Year' },
  { date: '2026-06-12', url: 'https://www.nidec.com/files/user/www-nidec-com/corporate/news/2026/0612-01/260612-01en.pdf', title: 'Notice Regarding Partial Amendments to the Articles of Incorporation' },
  { date: '2026-06-02', url: 'https://www.nidec.com/files/user/www-nidec-com/corporate/news/2026/0602-01/260602-01en.pdf', title: 'Notice Regarding ISS Report Recommending Votes in Favor of All Company Proposals at Nidecs 53rd Regular General Meeting of Shareholders' },
];

c.news = NIDEC_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'nidec.com',
}));

c.fallback_news = [];

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Nidec news after refill:', c.news.length);
console.log('  news_url:', c.news_url);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);
