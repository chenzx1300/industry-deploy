#!/usr/bin/env node
// Honeywell (霍尼韦尔 NASDAQ: HON) refill: 10 press releases from honeywell.com newsroom.
// As of 2026-06-29, Honeywell International completed spin-off of Honeywell Aerospace (trading as
// HONA). Remaining automation business retains "HON" ticker and trades as "Honeywell Technologies".
//
// Newsroom URL: https://www.honeywell.com/us/en/news
// Article URL pattern: /us/en/news/press-releases/YYYY/MM/<slug>
// Total available: 1528 press releases (sort desc)
//
// We use honeywell.com directly — rich cadence (no fallback needed).

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'honeywell');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('Honeywell not found in industries.json');

const now = new Date().toISOString();

// 10 most recent press releases (desc date) — all from official honeywell.com newsroom
const HONEYWELL_NEWS = [
  { date: '2026-06-29', title: 'Honeywell Technologies Launches As Independent, Pure-Play Automation Company Following Completion of Honeywell Aerospace Spin-Off', url: 'https://www.honeywell.com/us/en/news/press-releases/2026/06/honeywell-technologies-launches-independent-pure-play-automation-company-following-honeywell-aerospace-spin-off' },
  { date: '2026-06-29', title: 'Honeywell Technologies to Release Second Quarter Financial Results, Discuss 2026 Outlook and Hold Its Investor Conference Call on Thursday, July 23', url: 'https://www.honeywell.com/us/en/news/press-releases/2026/06/honeywell-technologies-to-release-second-quarter-financial-results-discuss-2026-outlook-and-hold-its-investor-conference-call-on-thursday-july-23' },
  { date: '2026-06-29', title: 'Honeywell Aerospace completes spin-off from Honeywell Technologies and begins trading on Nasdaq', url: 'https://www.honeywell.com/us/en/news/press-releases/2026/06/honeywell-aerospace-completes-spin-off-from-honeywell-technologies-and-begins-trading-on-nasdaq' },
  { date: '2026-06-24', title: 'Honeywell and MIT Find Digital Technologies can Help Increase Energy Supply, Reduce Energy Production Cost by Tens of Billions Annually', url: 'https://www.honeywell.com/us/en/news/press-releases/2026/06/honeywell-and-mit-find-digital-technologies-can-help-increase-energy-supply-reduce-energy-production-cost-by-tens-of-billions-annually' },
  { date: '2026-06-23', title: 'Honeywell Expands Fire Portfolio with Advanced Smoke Control and Connected Life Safety Innovations', url: 'https://www.honeywell.com/us/en/news/press-releases/2026/06/honeywell-expands-fire-portfolio-with-advanced-smoke-control-and-connected-life-safety-innovations' },
  { date: '2026-06-17', title: 'Honeywell Modular Technology to Power and Automate Acelen Renewables Biofuel Production', url: 'https://www.honeywell.com/us/en/news/press-releases/2026/06/honeywell-modular-technology-to-power-and-automate-acelen-renewables-biofuel-production' },
  { date: '2026-06-16', title: 'Honeywell Launches New Hospitality Solutions to Power the Connected Hotel', url: 'https://www.honeywell.com/us/en/news/press-releases/2026/06/honeywell-launches-new-hospitality-solutions-to-power-the-connected-hotel' },
  { date: '2026-06-15', title: 'Honeywell Board of Directors Approves Spin-Off of Honeywell Aerospace', url: 'https://www.honeywell.com/us/en/news/press-releases/2026/06/honeywell-board-of-directors-approves-spin-off-of-honeywell-aerospace' },
  { date: '2026-06-11', title: 'Honeywell Technologies Hosts 2026 Investor Day; Provides New Three-Year Financial Framework', url: 'https://www.honeywell.com/us/en/news/press-releases/2026/06/honeywell-technologies-hosts-2026-investor-day-provides-new-three-year-financial-framework' },
  { date: '2026-06-09', title: 'Honeywell Introduces Experion Cognition to Deliver Autonomous Control Room Operations for Borouge International', url: 'https://www.honeywell.com/us/en/news/press-releases/2026/06/honeywell-introduces-experion-cognition-to-deliver-autonomous-control-room-operations-for-borouge-international' },
];

c.news = HONEYWELL_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'honeywell.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Honeywell news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);