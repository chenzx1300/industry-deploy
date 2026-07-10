#!/usr/bin/env node
// Continental AG (ETR:CON) refill: 10 news items from AUMOVIO press portal.
//
// CRITICAL — 2025-09 spin-off:
// Continental spun off its automotive group sector as AUMOVIO SE (Frankfurt
// listing 2025-09-18, ticker AUMOV). The remaining Continental parent has
// divested ContiTech (2026-07-04, €4.0B sale to Lone Star) and is becoming
// pure-play tire manufacturing. ALL automotive electronics / motor-adjacent
// news is now on the AUMOVIO press portal, not continental.com/press/.
//
// Source: https://www.aumovio.com/en/company/press/press-releases.html
// Loaded "Load more" until 70+ items visible. Top 10 EN items (skipping
// CN/KR/RO localizations) by published date desc, with NEV-motor relevance:
//   2026-04-28  celebrates 20 years of digital tachograph
//   2026-04-23  AUMOVIO + trinamiX blood alcohol measurement in cockpit
//   2026-04-21  AUMOVIO + tesa debondable adhesive for automotive displays
//   2026-04-07  major order for OLED display with invisibly integrated camera
//   2026-02-02  Leapmotor relies on AUMOVIO solutions (DIRECTLY NEV)
//   2026-01-06  latest central-performance computer (NEV/AV compute)
//   2026-01-06  + AWS transform autonomous driving development (NEV/AV)
//   2026-01-05  surface projection cockpit (Display/HMI for NEV)
//   2025-12-11  New trailer assistants (ADAS for NEV)
//   2025-12-09  next-gen automotive tech at CES 2026 (NEV/AV)

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'continental');

const now = new Date().toISOString();

c.news_url = 'https://www.aumovio.com/en/company/press/press-releases.html';

const CONTY_NEWS = [
  { date: '2026-04-28', url: 'https://www.aumovio.com/en/company/press/press-releases/20260428-vdo-20-years-dtco.html', title: 'AUMOVIO celebrates 20 years of the digital tachograph' },
  { date: '2026-04-23', url: 'https://www.aumovio.com/en/company/press/press-releases/20260423-blood-alcohol.html', title: 'Finger touch instead of a breath test: AUMOVIO and trinamiX integrate blood alcohol measurement into the vehicle cockpit' },
  { date: '2026-04-21', url: 'https://www.aumovio.com/en/company/press/press-releases/20260421-display-debonding.html', title: 'AUMOVIO and tesa develop debondable adhesive solution for automotive displays' },
  { date: '2026-04-07', url: 'https://www.aumovio.com/en/company/press/press-releases/20260407-camera-under-oled.html', title: 'AUMOVIO secures major order for OLED display with invisibly integrated camera' },
  { date: '2026-02-02', url: 'https://www.aumovio.com/en/company/press/press-releases/20260202-leapmotor-coop.html', title: 'Leapmotor relies on AUMOVIO solutions for its most recent models' },
  { date: '2026-01-06', url: 'https://www.aumovio.com/en/company/press/press-releases/20260106-vc-hpc.html', title: "AUMOVIO's latest central-performance computer" },
  { date: '2026-01-06', url: 'https://www.aumovio.com/en/company/press/press-releases/20260106-aws-collaboration.html', title: 'AUMOVIO and AWS join forces to transform autonomous driving development' },
  { date: '2026-01-05', url: 'https://www.aumovio.com/en/company/press/press-releases/20260105-surface-projection.html', title: 'AUMOVIO surface projection cockpit-projection' },
  { date: '2025-12-11', url: 'https://www.aumovio.com/en/company/press/press-releases/20251211-trailer-assistants.html', title: 'New trailer assistants: AUMOVIO makes maneuvering with vehicle-trailer combinations easier and safer' },
  { date: '2025-12-09', url: 'https://www.aumovio.com/en/company/press/press-releases/20251209-ces-preview.html', title: 'AUMOVIO unveils next-gen automotive tech at CES 2026' },
];

c.news = CONTY_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'aumovio.com',
}));

c.fallback_news = [];

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Continental (AUMOVIO) news after refill:', c.news.length);
console.log('  news_url:', c.news_url);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);