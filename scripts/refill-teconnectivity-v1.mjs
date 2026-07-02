#!/usr/bin/env node
// TE Connectivity (国际公司) refill: te.com news-center (10 items, hardcoded)
// User approved 2026-07-02: "TE 可以" — confirmed te.com news-center as source.
//
// The news-center has two tabs ("Company News" / "Industry & New Product News");
// the corp-news-releases tab mixes both, all articles load fine.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'teconnectivity');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('TE Connectivity not found in industries.json');

const now = new Date().toISOString();

// 10 hardcoded items from te.com/en/about-te/news-center/ (pages 1-2).
// These are the most recent as of 2026-07-02.
const TE_NEWS = [
  { date: '2026-07-02', title: 'TE Connectivity launches next generation AMP+ Charging Inlets for electric vehicles', url: 'https://www.te.com/en/about-te/news-center/amp-charging-cables-and-inlets-next-gen-npi.html' },
  { date: '2026-05-27', title: 'TE Connectivity to power next generation AI data centers at COMPUTEX 2026', url: 'https://www.te.com/en/about-te/news-center/computex-2026.html' },
  { date: '2026-03-16', title: 'TE Connectivity launches 56G MezzaWave connectors and cable assemblies', url: 'https://www.te.com/en/about-te/news-center/56g-mezzawave.html' },
  { date: '2026-03-13', title: 'TE Connectivity to advance end-to-end optical infrastructure for next-generation AI data centers at OFC 2026', url: 'https://www.te.com/en/about-te/news-center/te-ofc-2026.html' },
  { date: '2026-02-28', title: 'TE Connectivity acquires EV charging inlet assets from Phoenix Contact', url: 'https://www.te.com/en/about-te/news-center/phoenixcontact.html' },
  { date: '2026-02-25', title: 'TE Connectivity to showcase rugged connectivity and high-speed interconnect solutions at embedded world 2026', url: 'https://www.te.com/en/about-te/news-center/embedded-world-2026.html' },
  { date: '2026-01-29', title: 'Next2OEM: TE Connectivity actively shaping the future of automated wiring harness production', url: 'https://www.te.com/en/about-te/news-center/next2oem.html' },
  { date: '2025-11-20', title: 'TE Connectivity expands rapid prototyping with new PROPELUS Prototype Centers in Wilsonville and Tlalnepantla', url: 'https://www.te.com/en/about-te/news-center/propelus-wv-tl-opening.html' },
  { date: '2025-11-11', title: 'TE Connectivity to showcase fully automated manufacturing cell with Cellios at Productronica 2025', url: 'https://www.te.com/en/about-te/news-center/productronica-2025.html' },
  { date: '2025-10-20', title: 'TE AI Hub convenes AWS and leading universities for industry-academia AI collaboration', url: 'https://www.te.com/en/about-te/news-center/singapore-ai-hub-hackathon.html' },
];

c.news = TE_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'te.com',
}));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('TE Connectivity news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);
