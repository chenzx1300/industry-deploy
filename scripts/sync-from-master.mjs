#!/usr/bin/env node
// Sync data/<slug>.json from data/industries.json (master).
// Both schemas have `companies[]` but industries.json (master) is the source of truth
// after refill scripts run. This script writes per-slug files so translate-news.mjs
// and render-from-json.mjs can run downstream.

import { readFileSync, writeFileSync } from 'node:fs';

const master = JSON.parse(readFileSync('data/industries.json', 'utf-8'));
let updated = 0;
for (const ind of master.industries) {
  const fp = `data/${ind.slug}.json`;
  const data = {
    slug: ind.slug,
    prompt: ind.prompt,
    generated_at: new Date().toISOString(),
    companies: ind.companies,
  };
  writeFileSync(fp, JSON.stringify(data, null, 2));
  const totalNews = data.companies.reduce((s, c) => s + (c.news ? c.news.length : 0), 0);
  console.log(`✓ ${fp}  ${data.companies.length} cos  ${totalNews} news items`);
  updated++;
}
console.log(`\nUpdated ${updated} slug files from master.`);