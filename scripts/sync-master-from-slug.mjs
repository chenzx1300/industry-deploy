#!/usr/bin/env node
// Sync data/industries.json (master) from data/<slug>.json files.
// After refill-v1 scripts that wrote to slug files (e.g., byd/catl/nio/li/xpeng/etc),
// the slug files have news arrays but the master config doesn't. This script updates
// master .news fields from slug files so they propagate on the next sync-down.
//
// Note: news_url, fallback_news (etc.) come FROM master, only news[] comes from slug.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const master = JSON.parse(readFileSync('data/industries.json', 'utf-8'));
let updated = 0;

for (const ind of master.industries) {
  const fp = `data/${ind.slug}.json`;
  if (!existsSync(fp)) continue;
  const slugData = JSON.parse(readFileSync(fp, 'utf-8'));
  let totalNews = 0;
  for (const masterCo of ind.companies) {
    const slugCo = (slugData.companies || []).find(x => x.id === masterCo.id);
    if (!slugCo) continue;
    if (slugCo.news && slugCo.news.length > 0) {
      masterCo.news = slugCo.news;
    }
    totalNews += (masterCo.news || []).length;
  }
  console.log(`✓ ${ind.slug}: ${totalNews} news items propagated back to master`);
  updated++;
}

writeFileSync('data/industries.json', JSON.stringify(master, null, 2));
console.log(`\nUpdated ${updated} industries with news from slug files.`);