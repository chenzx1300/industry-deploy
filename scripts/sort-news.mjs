#!/usr/bin/env node
// Sort all news arrays by published_at DESC (newest first).
// Items with invalid/missing published_at are pushed to the end.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');

function validDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
let totalChanged = 0;
for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  if (!existsSync(fp)) continue;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;
  for (const c of data.companies) {
    const before = c.news.map(n => n.url);
    c.news.sort((a, b) => {
      const da = validDate(a.published_at);
      const db = validDate(b.published_at);
      if (da && db) return db - da;
      if (da) return -1;
      if (db) return 1;
      return 0;
    });
    const after = c.news.map(n => n.url);
    if (before.some((u, i) => u !== after[i])) touched = true;
  }
  if (touched) {
    writeFileSync(fp, JSON.stringify(data, null, 2));
    totalChanged++;
    console.log(`✓ ${ind.slug}: sorted`);
  }
}
console.log(`\n=== Sorted ${totalChanged} industry files ===`);
