#!/usr/bin/env node
// Fetch real news for companies that currently have empty news arrays.
// Uses Bing News (already integrated via src/lib/bing-news.mjs) to find
// real article URLs, then validates them via head() check.
//
// Usage: node scripts/fetch-missing-news.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';
import { fetchMetaSummary } from '../src/lib/html-helpers.mjs';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const PER_COMPANY = 3;

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
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let industryTouched = false;

  for (const c of data.companies) {
    const existing = c.news || [];
    // Skip companies that already have enough news.
    if (existing.length >= 1) continue;

    console.log(`\n▸ ${ind.slug}/${c.id} (${c.name}): ${existing.length} news — fetching ${PER_COMPANY} via Bing...`);
    let results = [];
    // Try the company's official name first
    results = await fetchBingNews(c.name, { maxResults: PER_COMPANY * 3 });
    if (results.length < PER_COMPANY) {
      // Fallback: domain-based search
      const domain = (c.domain || '').replace(/^www\./, '').split('.')[0];
      if (domain) {
        const more = await fetchBingNews(`${c.name} ${domain}`, { maxResults: PER_COMPANY * 3 });
        results = results.concat(more);
      }
    }

    // Dedupe by URL
    const seen = new Set(existing.map(n => n.url));
    const candidates = [];
    for (const r of results) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      candidates.push(r);
      if (candidates.length >= PER_COMPANY) break;
    }

    // Validate URLs via HEAD
    const validated = [];
    for (const cand of candidates) {
      const ok = await headOk(cand.url);
      if (ok) {
        validated.push(cand);
        console.log(`  ✓ ${cand.title.substring(0, 60)} — ${cand.url.substring(0, 50)}`);
      } else {
        console.log(`  ✗ ${cand.title.substring(0, 60)} — HEAD failed (${cand.url.substring(0, 50)})`);
      }
    }

    if (validated.length > 0) {
      c.news = validated.map(v => ({
        title: v.title,
        url: v.url,
        snippet: '',
        published_at: null,
        fetched_at: new Date().toISOString(),
        source: (new URL(v.url)).hostname.replace(/^www\./, ''),
      }));
      industryTouched = true;
      totalAdded += c.news.length;
    } else {
      skipped.push({ slug: ind.slug, co: c.id, name: c.name });
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
  for (const s of skipped) console.log(`  - ${s.slug}/${s.co} (${s.name})`);
}