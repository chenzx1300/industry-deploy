#!/usr/bin/env node
// Clean placeholder-ID URLs (e.g. /show-126.html) that were hand-curated
// but don't resolve to real news. Replace with the company's news_url
// (press release listing page) so users at least land on a real page.
//
// This is a STOP-GAP until the user manually verifies real article URLs.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SLUGS = ['semiconductor-industry','new-energy-vehicles-industry','carbon-fiber-industry','thermal-materials-industry','composite-insulator-industry','datacenter-cooling-industry'];

const PLACEHOLDER_PATTERNS = [
  /\/show-\d+\.html?$/i,
  /\/id-\d+\.html?$/i,
  /\/news\/\d+\.html?$/i,
  /\/press\/\d+\.html?$/i,
  /\/news_detail\/id-\d+\.html?$/i,
];

let totalReplaced = 0;
for (const slug of SLUGS) {
  const fp = join('data', `${slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  for (const c of data.companies) {
    const newsUrl = (c.news_url || c.domain || '').replace(/\/+$/, '');
    if (!newsUrl.startsWith('http')) continue;
    for (const n of c.news || []) {
      const u = n.url || '';
      const isPlaceholder = PLACEHOLDER_PATTERNS.some(p => p.test(u));
      if (isPlaceholder) {
        n.url = newsUrl + '/press-releases/';
        n._needs_user_verification = true;
        totalReplaced += 1;
      }
    }
  }
  writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✓ ${slug}: cleaned`);
}
console.log(`\n✓ Total placeholder URLs replaced: ${totalReplaced}`);
console.log('  These now point to the company press-release listing page.');
console.log('  Run `node scripts/validate-links.mjs` to confirm.');
console.log('  Open docs/audit-report.html to review.');