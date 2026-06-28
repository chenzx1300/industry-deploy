#!/usr/bin/env node
// Bulk-top-up: for every company in every industry that has < TARGET_COUNT
// news items, fetch more from Bing News (which itself prefers the company's
// official site). Validate via HEAD, dedupe by URL, then merge.
//
// Usage:
//   node scripts/topup-news.mjs                 # default target = 10
//   TARGET=5 node scripts/topup-news.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);

async function headOk(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
    });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
let totalAdded = 0;
const skipped = [];

for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  if (!existsSync(fp)) continue;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let industryTouched = false;

  for (const c of data.companies) {
    const existing = c.news || [];
    const need = TARGET - existing.length;
    if (need <= 0) continue;

    console.log(`\n▸ ${ind.slug}/${c.id} (${c.name}): have ${existing.length}, need ${need} — fetching...`);
    let results = [];
    // 1. Try company name + site:domain
    const domain = (c.domain || '').replace(/^www\./, '');
    if (domain) {
      const siteResults = await fetchBingNews(`${c.name} site:${domain}`, { maxResults: need * 2 });
      results.push(...siteResults);
    }
    // 2. Then plain company name
    const plainResults = await fetchBingNews(c.name, { maxResults: need * 2 });
    results.push(...plainResults);

    // Dedupe by URL
    const seen = new Set(existing.map(n => n.url));
    const candidates = [];
    for (const r of results) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      candidates.push(r);
    }

    // Validate URLs via HEAD (in parallel, max 6 at a time)
    const validated = [];
    const queue = [...candidates];
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const cand = queue.shift();
        const ok = await headOk(cand.url);
        if (ok) validated.push(cand);
        if (validated.length >= need) break;
      }
    }));

    if (validated.length > 0) {
      const toAdd = validated.slice(0, need).map(v => ({
        title: v.title,
        url: v.url,
        snippet: '',
        published_at: null,
        fetched_at: new Date().toISOString(),
        source: (() => { try { return new URL(v.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
      }));
      c.news = [...existing, ...toAdd];
      industryTouched = true;
      totalAdded += toAdd.length;
      console.log(`  ✓ added ${toAdd.length}`);
    } else {
      skipped.push({ slug: ind.slug, co: c.id, name: c.name, had: existing.length });
      console.log(`  ✗ no valid Bing results`);
    }
  }

  if (industryTouched) {
    writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
  }
}

console.log(`\n=== Summary ===`);
console.log(`Added: ${totalAdded} news items`);
if (skipped.length) {
  console.log(`Skipped (no valid Bing results):`);
  for (const s of skipped) console.log(`  - ${s.slug}/${s.co} (${s.name}, had ${s.had})`);
}