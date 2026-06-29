#!/usr/bin/env node
// Drop weixin.sogou.com items without a published_at date. These are
// Sogou WeChat redirect links whose real publish date is hidden by
// Sogou's anti-scraping (the redirect URL has no date metadata and
// we can't resolve it without browser cookies). Without a date we
// cannot verify "past 1 year" — and the user has flagged 2023
// entries from this source.
//
// Run filter-recent.mjs (or topup) afterwards to refill any
// companies that drop below 10.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SLUGS = [
  'semiconductor-industry','new-energy-vehicles-industry','carbon-fiber-industry',
  'thermal-materials-industry','composite-insulator-industry','datacenter-cooling-industry',
];
const CUTOFF = new Date('2025-06-29T00:00:00Z');

let totalRemoved = 0;
const droppedByCo = {};

for (const slug of SLUGS) {
  const fp = join('data', `${slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;
  for (const c of data.companies) {
    const before = c.news.length;
    c.news = c.news.filter(n => {
      if (!n.url || !n.url.includes('weixin.sogou.com')) return true;
      // Sogou items: keep only if they have a date >= cutoff
      if (!n.published_at) return false;
      const t = new Date(n.published_at);
      return !isNaN(t.getTime()) && t >= CUTOFF;
    });
    const after = c.news.length;
    if (before !== after) {
      console.log(`${slug}/${c.id}: ${before} → ${after} (removed ${before - after} undated Sogou)`);
      droppedByCo[`${slug}/${c.id}`] = { before, after, dropped: before - after };
      totalRemoved += (before - after);
      touched = true;
    }
  }
  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

console.log(`\n=== Total removed: ${totalRemoved} ===`);
console.log('\nBelow-target companies (need refill):');
for (const [k, v] of Object.entries(droppedByCo)) {
  if (v.after < 10) console.log(`  ${k}: ${v.after}/10 (need ${10 - v.after})`);
}
