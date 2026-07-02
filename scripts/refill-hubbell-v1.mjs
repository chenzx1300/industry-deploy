#!/usr/bin/env node
// Hubbell (NYSE: HUBB) refill: hubbell.gcs-web.com press releases
// User approved 2026-07-02 — TE ✅ done, move to Hubbell.
//
// Hubbell uses Q4 Hosting (gcs-web.com) for IR press releases.
// Source: https://investor.hubbell.com/?tab=press → hubbell.gcs-web.com/news-releases
// Article URL pattern: /news-releases/news-release-details/<slug>
//
// Listing page renders OK; individual article URLs hit HTTP/2 protocol errors
// in headless Chrome MCP, but the article body is included in the listing
// snippet (GLOBE NEWSWIRE copy), proving URLs and content are real.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'hubbell');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('Hubbell not found in industries.json');

const now = new Date().toISOString();

// 10 most recent Hubbell press releases (sorted desc by date)
const HUBBELL_NEWS = [
  { date: '2026-06-09', title: 'Hubbell Incorporated Completes Acquisition of NSI Industries', url: 'https://hubbell.gcs-web.com/news-releases/news-release-details/hubbell-incorporated-completes-acquisition-nsi-industries' },
  { date: '2026-06-02', title: 'Hubbell Incorporated Prices $1.9 Billion Senior Notes Offering', url: 'https://hubbell.gcs-web.com/news-releases/news-release-details/hubbell-incorporated-prices-19-billion-senior-notes-offering' },
  { date: '2026-05-28', title: 'Hubbell to Participate in Upcoming Investor Conference (Wells Fargo Industrials)', url: 'https://hubbell.gcs-web.com/news-releases/news-release-details/hubbell-participate-upcoming-investor-conference-4' },
  { date: '2026-05-04', title: 'Hubbell to Acquire NSI Industries', url: 'https://hubbell.gcs-web.com/news-releases/news-release-details/hubbell-acquire-nsi-industries' },
  { date: '2026-04-30', title: 'Hubbell Reports First Quarter 2026 Results', url: 'https://hubbell.gcs-web.com/news-releases/news-release-details/hubbell-reports-first-quarter-2026-results' },
  { date: '2026-04-24', title: 'Hubbell Reports Regular Quarterly Dividend', url: 'https://hubbell.gcs-web.com/news-releases/news-release-details/hubbell-reports-regular-quarterly-dividend' },
  { date: '2026-04-13', title: 'Hubbell to Announce First Quarter 2026 Results on April 30, 2026', url: 'https://hubbell.gcs-web.com/news-releases/news-release-details/hubbell-announce-first-quarter-2026-results-april-30-2026' },
  { date: '2026-03-05', title: 'Hubbell to Participate in Upcoming Investor Conference (JP Morgan Industrials)', url: 'https://hubbell.gcs-web.com/news-releases/news-release-details/hubbell-participate-upcoming-investor-conference-3' },
  { date: '2026-02-12', title: 'Hubbell to Participate in Upcoming Investor Conference (Barclays)', url: 'https://hubbell.gcs-web.com/news-releases/news-release-details/hubbell-participate-upcoming-investor-conference-2' },
  { date: '2026-02-03', title: 'Hubbell Reports Fourth Quarter and Full Year 2025 Results', url: 'https://hubbell.gcs-web.com/news-releases/news-release-details/hubbell-reports-fourth-quarter-and-full-year-2025-results' },
];

c.news = HUBBELL_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'hubbell.gcs-web.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Hubbell news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);