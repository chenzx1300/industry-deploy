#!/usr/bin/env node
// Magna International (TSX:MG / NYSE:MGA) refill: 10 news items from
// https://www.magna.com/newsroom/news
//
// All 12+ items on page 1 extracted 2026-07-10 via Chrome MCP. Top 10 by
// published date desc (2026-05-21 → 2025-09-15). Strong content match for
// NEV motor industry: DHD REX Hybrid Drive, China EV footprint, XPENG
// vehicle assembly, GAC Europe EV, NVIDIA Drive Hyperion.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'magna');

const now = new Date().toISOString();

c.news_url = 'https://www.magna.com/newsroom/news?year=all&lang=en&page=1';

const MAGNA_NEWS = [
  { date: '2026-05-21', url: 'https://www.magna.com/stories/news-press-release/2026/magna-earns-five-2025-general-motors-supplier-of-the-year-awards', title: 'Magna Earns Five 2025 General Motors Supplier of the Year Awards' },
  { date: '2026-05-19', url: 'https://www.magna.com/stories/news-press-release/2026/magna-awarded-driver-and-occupant-monitoring-system-program-with-european-oem', title: 'Magna Awarded Driver and Occupant Monitoring System Program with European OEM' },
  { date: '2026-04-09', url: 'https://www.magna.com/stories/news-press-release/2026/magna-announces-sale-of-its-lighting-and-rooftop-systems-businesses', title: 'Magna Announces Sale of its Lighting and Rooftop Systems Businesses' },
  { date: '2026-03-24', url: 'https://www.magna.com/stories/news-press-release/2026/magna-unveils-dhd-rex-hybrid-drive-for-enhanced-ev-range', title: 'Magna Unveils DHD REX Hybrid Drive for Enhanced EV Range' },
  { date: '2026-01-05', url: 'https://www.magna.com/stories/news-press-release/2026/magna-to-offer-drive-hyperion-compatible-ecus-and-tier-1-integration-services-for-nvidia-drive-av', title: 'Magna to Offer Drive Hyperion-Compatible ECUs and Tier-1 Integration Services for NVIDIA Drive AV' },
  { date: '2025-11-21', url: 'https://www.magna.com/stories/news-press-release/2025/gac-accelerates-european-ev-strategy-with-magna-vehicle-assembly-program', title: 'GAC Accelerates European EV Strategy with Magna Vehicle Assembly Program' },
  { date: '2025-11-19', url: 'https://www.magna.com/stories/news-press-release/2025/magna-deepens-china-footprint-to-meet-growing-ev-demand', title: 'Magna Deepens China Footprint to Meet Growing EV Demand' },
  { date: '2025-10-29', url: 'https://www.magna.com/stories/news-press-release/2025/magna-ramps-up-driver-and-occupant-monitoring-system-deployment-in-china-with-germany-based-oem', title: 'Magna Ramps Up Driver and Occupant Monitoring System Deployment in China with Germany-Based OEM' },
  { date: '2025-09-15', url: 'https://www.magna.com/stories/news-press-release/2025/magna-awarded-vehicle-assembly-business-with-chinese-oem-xpeng', title: 'Magna Awarded Vehicle Assembly Business with Chinese OEM XPENG' },
  { date: '2025-08-11', url: 'https://www.magna.com/stories/news-press-release/2025/magna-to-showcase-its-vision-for-safer--smarter--greener-mobility-at-iaa-mobility-2025', title: 'Magna to Showcase Its Vision for Safer, Smarter, Greener Mobility at IAA Mobility 2025' },
];

c.news = MAGNA_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'magna.com',
}));

c.fallback_news = [];

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Magna news after refill:', c.news.length);
console.log('  news_url:', c.news_url);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);
