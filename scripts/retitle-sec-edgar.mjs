#!/usr/bin/env node
// In-place retitle of SEC EDGAR placeholder titles like
// "Honeywell 8-K — 0000773840-26-000084" → "Honeywell 8-K: Current Report".
// Pulls primaryDocDescription from data.sec.gov/submissions/CIK<cik>.json
// and matches by accession number embedded in the filing URL.
//
// Usage: node scripts/retitle-sec-edgar.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const UA = 'Mozilla/5.0 chenzx1300-industry-deploy@example.com';

const SEC_COMPANIES = {
  nvidia: { cik: '0001045810', name: 'NVIDIA' },
  tsmc: { cik: '0001046179', name: 'Taiwan Semiconductor' },
  xpeng: { cik: '0001810997', name: 'XPeng' },
  li: { cik: '0001791706', name: 'Li Auto' },
  hubbell: { cik: '0000048898', name: 'Hubbell' },
  teconnectivity: { cik: '0001385157', name: 'TE Connectivity' },
  vertiv: { cik: '0001674101', name: 'Vertiv' },
  honeywell: { cik: '0000773840', name: 'Honeywell' },
  intel: { cik: '0000050863', name: 'Intel' },
  nio: { cik: '0001736541', name: 'NIO' },
  abb: { cik: '0001091587', name: 'ABB' },
};

// Extract accession from URL like
// https://www.sec.gov/Archives/edgar/data/1046179/000104617926000377/tsm-revenue20260610.htm
function accessionFromUrl(url) {
  if (!url) return null;
  const m = url.match(/data\/\d+\/(\d{18})\//);
  if (m) {
    const a = m[1];
    return `${a.slice(0,10)}-${a.slice(10,12)}-${a.slice(12,18)}`;
  }
  return null;
}

async function fetchDescriptions(cik) {
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return new Map();
    const j = await r.json();
    const recent = j.filings.recent;
    const map = new Map();
    for (let i = 0; i < recent.form.length; i++) {
      const acc = recent.accessionNumber[i];
      const desc = (recent.primaryDocDescription[i] || '').trim();
      const form = recent.form[i];
      map.set(acc, { desc, form });
    }
    return map;
  } catch {
    return new Map();
  }
}

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
let totalReplaced = 0;
const cikQueue = new Set();

for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;
  for (const c of data.companies) {
    const sec = SEC_COMPANIES[c.id];
    if (!sec) continue;
    for (const n of c.news) {
      if (!n.url || !n.url.includes('sec.gov')) continue;
      if (n.title && !/—\s*\d{10}-\d{2}-\d{6}/.test(n.title)) continue;  // not a placeholder
      cikQueue.add(sec.cik);
    }
  }
}

console.log(`Fetching descriptions for ${cikQueue.size} CIKs...`);
const descMaps = {};
for (const cik of cikQueue) {
  descMaps[cik] = await fetchDescriptions(cik);
  console.log(`  CIK ${cik}: ${descMaps[cik].size} filings indexed`);
}

for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;
  for (const c of data.companies) {
    const sec = SEC_COMPANIES[c.id];
    if (!sec) continue;
    const map = descMaps[sec.cik] || new Map();
    let replaced = 0;
    for (const n of c.news) {
      if (!n.url || !n.url.includes('sec.gov')) continue;
      const acc = accessionFromUrl(n.url);
      if (!acc) continue;
      const info = map.get(acc);
      if (!info) continue;
      const newTitle = info.desc
        ? `${sec.name} ${info.form}: ${info.desc}`
        : `${sec.name} ${info.form} (${acc})`;
      if (newTitle !== n.title) {
        n.title = newTitle;
        replaced++;
        touched = true;
        totalReplaced++;
      }
    }
    if (replaced > 0) console.log(`  ${ind.slug}/${c.id}: retitled ${replaced}`);
  }
  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2));
}

console.log(`\n=== Total retitled: ${totalReplaced} ===`);
