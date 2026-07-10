#!/usr/bin/env node
// Robert Bosch GmbH (private) refill: 10 news items from
// https://www.bosch.com/research/news/
//
// CRITICAL: Bosch's primary press domain `bosch.com/news` returns 404 (redirects
// to a JS shell) and `news.bosch.com` DNS-fails from this region. The only
// reliable Bosch domain with chrome-mcp-renderable content is /research/news/,
// which is research-focused but DOES contain mobility/electrification items
// (Stadtpilot autonomous driving, Charger-Converters for EVs, Bosch+Cambridge
// power semiconductors for electromobility, hydrogen fuel-cell power module).
//
// All 36 items on the research page extracted 2026-07-10 via Chrome MCP
// evaluate_script. Top 10 by date desc with NEV-motor / e-mobility relevance:
//
// 2026-06-10  Urban autonomous driving  (Stuttgart)
// 2025-11-19  Bosch team wins Deutscher Zukunftspreis with fuel-cell power module (Berlin)
// 2025-10-22  Ten years of Renningen Research Campus
// 2025-10-14  Intelligent infrastructure can advance automated driving (Renningen)
// 2025-06-16  Bosch advances sustainable MEMS production (sensor supply for NEV)
// 2024-06-05  Energy transition, electrification, electrolysis — research (Renningen)
// 2024-03-27  Bosch expanding vehicle functionality with edge cloud (Renningen)
// 2023-04-27  New Charger-Converters for Electric Vehicles (Renningen) — DIRECTLY NEV
// 2023-03-27  Bosch+Cambridge new power semiconductors for electromobility — DIRECTLY NEV
// 2023-01-24  Bosch as powerhouse of the hydrogen economy (Renningen)

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'bosch');

const now = new Date().toISOString();

c.news_url = 'https://www.bosch.com/research/news/';

const BOSCH_NEWS = [
  { date: '2026-06-10', url: 'https://www.bosch.com/research/news/looking-back-at-the-stadt-up-project/', title: 'Urban autonomous driving' },
  { date: '2025-11-19', url: 'https://www.bosch.com/research/news/bosch-deutscher-zukunftspreis-2025/', title: 'Bosch team wins the Deutscher Zukunftspreis with fuel-cell power module' },
  { date: '2025-10-22', url: 'https://www.bosch.com/research/news/ten-years-bosch-research-campus-renningen/', title: 'Ten years of the Renningen Research Campus' },
  { date: '2025-10-14', url: 'https://www.bosch.com/research/news/shuttle2x-automated-driving/', title: 'Intelligent infrastructure can advance automated driving' },
  { date: '2025-06-16', url: 'https://www.bosch.com/research/news/sustainable-mems-production/', title: 'Bosch advances sustainable MEMS production' },
  { date: '2024-06-05', url: 'https://www.bosch.com/research/news/world-environment-day/', title: 'Energy transition, electrification, and electrolysis — research highlights' },
  { date: '2024-03-27', url: 'https://www.bosch.com/research/news/ipcei-cis-project/', title: 'Bosch is expanding vehicle functionality with edge cloud' },
  { date: '2023-04-27', url: 'https://www.bosch.com/research/news/cooperation-with-the-technical-university-of-munich/', title: 'Cleverly combined: New Charger-Converters for Electric Vehicles' },
  { date: '2023-03-27', url: 'https://www.bosch.com/research/news/cooperation-with-the-university-of-cambridge/', title: 'Bosch and Cambridge develop new power semiconductors for electromobility' },
  { date: '2023-01-24', url: 'https://www.bosch.com/research/news/hydrogen-innovations/', title: 'Bosch as a powerhouse of the hydrogen economy' },
];

c.news = BOSCH_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'bosch.com',
}));

c.fallback_news = [];

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Bosch news after refill:', c.news.length);
console.log('  news_url:', c.news_url);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);