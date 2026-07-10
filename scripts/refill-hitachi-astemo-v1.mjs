#!/usr/bin/env node
// Hitachi Astemo (now Astemo, Ltd. — rebranded 2025) refill: 10 news items.
//
// Source: https://www.astemo.com/en/news/
//
// CRITICAL: hitachiastemo.com → astemo.com redirect (rebranded 2025). Astemo
// is the former Hitachi Automotive Systems + Honda-affiliated JV. STRONG
// NEV-motor content: motors/inverters for Nissan LEAF, rare-earth-free motors,
// in-wheel EV direct-drive, inverter production for next-gen EVs.
//
// 50+ items on news page extracted 2026-07-10 via Chrome MCP. Top 10
// NEV-motor-relevant by date desc:
//   2026-06-30  Notice of postponed execution date for scheduled changes to capital structure
//   2026-06-29  new corporate brand message "Innovating dreams into motion" at JR Shinjuku
//   2026-06-24  Astemo Cypremos to showcase latest SDV engineering solutions at Response Conference 2026
//   2026-06-18  Astemo Announces Executive Changes, Replacement of Subsidiary CEO
//   2026-06-17  Astemo Announces Change in Board Directors
//   2026-06-16  Astemo begins FY2026 promotional activities with launch of new corporate brand message
//   2026-06-12  Astemo sponsors Automotive Summit 2026 to showcase advanced smart mobility technologies
//   2026-06-11  Astemo's motors and inverters adopted for Nissan's new EV "Nissan LEAF" (DIRECTLY NEV MOTOR)
//   2026-05-29  Astemo announces change in Representative Director, President & CEO
//   2026-05-21  Astemo to showcase advanced solutions driving SDV age at Automotive Engineering Exposition 2026 YOKOHAMA
//
// Hardcoded top 10 by date desc, mixing Corporate/HR with NEV-motor content
// (same governance-heavy pattern as Nidec/Aisin).

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'hitachi-astemo');

const now = new Date().toISOString();

c.news_url = 'https://www.astemo.com/en/news/';

const ASTEMO_NEWS = [
  { date: '2026-06-30', url: 'https://www.astemo.com/en/news/pdf/20260630-01.pdf', title: 'Notice of postponed execution date for scheduled changes to capital structure' },
  { date: '2026-06-29', url: 'https://www.astemo.com/en/news/20260629-01/', title: 'Astemo to display new corporate brand message, "Innovating dreams into motion," on large-scale digital signage at JR Shinjuku station' },
  { date: '2026-06-24', url: 'https://www.astemo.com/en/news/20260624-01/', title: 'Astemo Cypremos to showcase latest SDV engineering solutions at Response Conference 2026' },
  { date: '2026-06-18', url: 'https://www.astemo.com/en/assets/pdf/news/20260618-01.pdf', title: 'Astemo Announces Executive Changes, Replacement of Subsidiary CEO' },
  { date: '2026-06-17', url: 'https://www.astemo.com/en/assets/pdf/news/20260617-01.pdf', title: 'Astemo Announces Change in Board Directors' },
  { date: '2026-06-16', url: 'https://www.astemo.com/en/news/20260616-01/', title: 'Astemo begins FY2026 promotional activities with launch of new corporate brand message' },
  { date: '2026-06-12', url: 'https://www.astemo.com/en/news/20260612-01/', title: 'Astemo sponsors Automotive Summit 2026 to showcase advanced smart mobility technologies for the SDV era' },
  { date: '2026-06-11', url: 'https://www.astemo.com/en/news/20260611-01/', title: 'Astemo\'s motors and inverters adopted for Nissan\'s new EV, the "Nissan LEAF"' },
  { date: '2026-05-29', url: 'https://www.astemo.com/en/assets/pdf/news/20260529-02.pdf', title: 'Astemo announces change in Representative Director, President & CEO' },
  { date: '2026-05-21', url: 'https://www.astemo.com/en/news/20260521-01/', title: 'Astemo to showcase advanced solutions and innovative products driving the SDV age at Automotive Engineering Exposition 2026 YOKOHAMA' },
];

c.news = ASTEMO_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'astemo.com',
}));

c.fallback_news = [];

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Astemo (Hitachi Astemo) news after refill:', c.news.length);
console.log('  news_url:', c.news_url);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);