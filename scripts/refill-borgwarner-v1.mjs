#!/usr/bin/env node
// BorgWarner Inc. (NYSE:BWA) refill: 10 news items from
// https://www.borgwarner.com/newsroom/press-releases
//
// All 20 items on page 1 extracted 2026-07-10 via Chrome MCP. Top 10 by
// published date desc, all 2026-02-11 → 2026-06-24. Strong content match for
// NEV motor industry: eMotors, integrated drive module, 48V eXD, hybrid
// powertrain, VTG turbo, BMS, eTurbo.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'borgwarner');

const now = new Date().toISOString();

c.news_url = 'https://www.borgwarner.com/newsroom/press-releases';

const BORG_NEWS = [
  { date: '2026-06-24', url: 'https://www.borgwarner.com/newsroom/press-releases/2026/06/24/borgwarner-awarded-on-time-s-list-of-the-world-s-most-sustainable-companies-2026', title: "BorgWarner Awarded on TIME's List of the World's Most Sustainable Companies 2026" },
  { date: '2026-05-06', url: 'https://www.borgwarner.com/newsroom/press-releases/2026/05/06/borgwarner-secures-multiple-turbocharger-awards-with-major-european-oem', title: 'BorgWarner Secures Multiple Turbocharger Awards with Major European OEM' },
  { date: '2026-05-06', url: 'https://www.borgwarner.com/newsroom/press-releases/2026/05/06/borgwarner-to-supply-variable-turbine-geometry-turbocharger-and-exhaust-gas-recirculation-cooler-for-major-european-commercial-vehicle-oem', title: 'BorgWarner to Supply Variable Turbine Geometry Turbocharger and Exhaust Gas Recirculation Cooler for Major European Commercial Vehicle OEM' },
  { date: '2026-05-06', url: 'https://www.borgwarner.com/newsroom/press-releases/2026/05/06/borgwarner-wins-two-conquest-awards-in-asia-for-combustion-and-hybrid-powertrain-programs', title: 'BorgWarner Wins Two Conquest Awards in Asia for Combustion and Hybrid Powertrain Programs' },
  { date: '2026-05-06', url: 'https://www.borgwarner.com/newsroom/press-releases/2026/05/06/borgwarner-reports-strong-first-quarter-2026-results--returned--185-million-to-shareholders-during-first-quarter-2026--announces-12-awards-across-portfolio-to-support-long-term-profitable-growth', title: 'BorgWarner Reports Strong First Quarter 2026 Results, Returned $185 million to Shareholders During First Quarter 2026, Announces 12 Awards Across Portfolio to Support Long-Term Profitable Growth' },
  { date: '2026-04-30', url: 'https://www.borgwarner.com/newsroom/press-releases/2026/04/30/borgwarner-secures-three-electric-motor-awards-in-china-and-south-korea', title: 'BorgWarner Secures Three Electric Motor Awards in China and South Korea' },
  { date: '2026-04-30', url: 'https://www.borgwarner.com/newsroom/press-releases/2026/04/30/borgwarner-declares-quarterly-dividend', title: 'BorgWarner Declares Quarterly Dividend' },
  { date: '2026-04-28', url: 'https://www.borgwarner.com/newsroom/press-releases/2026/04/28/borgwarner-showcases-thermal--power-electronics--battery-solutions-at-advanced-clean-transportation-expo-2026', title: 'BorgWarner Showcases Thermal, Power Electronics, Battery Solutions at Advanced Clean Transportation Expo 2026' },
  { date: '2026-04-21', url: 'https://www.borgwarner.com/newsroom/press-releases/2026/04/21/borgwarner-extends-controller-business-with-world-leading-off-highway-manufacturer', title: 'BorgWarner Extends Controller Business with World-Leading Off-Highway Manufacturer' },
  { date: '2026-02-11', url: 'https://www.borgwarner.com/newsroom/press-releases/2026/02/11/borgwarner-secures-its-first-48v-electric-cross-differential-program', title: 'BorgWarner Secures Its First 48V Electric Cross Differential Program' },
];

c.news = BORG_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'borgwarner.com',
}));

c.fallback_news = [];

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('BorgWarner news after refill:', c.news.length);
console.log('  news_url:', c.news_url);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);
