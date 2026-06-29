#!/usr/bin/env node
// Filter news to past 1 year (2025-06-29 → today).
//
// A news item is dropped if its publish date can be determined (from
// `published_at`, from a date pattern in the title, from the URL path,
// or from a `datePublished` meta tag / `<time>` element on the page)
// AND that date is older than 1 year.
//
// Items with no date evidence anywhere are KEPT — they are undatable,
// not necessarily old.
//
// Usage: node scripts/filter-recent.mjs [--dry]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SLUGS = [
  'semiconductor-industry','new-energy-vehicles-industry','carbon-fiber-industry',
  'thermal-materials-industry','composite-insulator-industry','datacenter-cooling-industry',
];
const DRY = process.argv.includes('--dry');
const CUTOFF = new Date('2025-06-29T00:00:00Z');
const CONCURRENCY = 12;
const FETCH_TIMEOUT = 6000;

// Patterns
const TITLE_DATE_RES = [
  /(\d{4})年(\d{1,2})月(\d{1,2})日/,
  /(\d{4})年(\d{1,2})月/,
];
const URL_DATE_RES = [
  /[\/\-_](\d{4})[\/\-_](\d{1,2})[\/\-_](\d{1,2})(?:[\/\-_]|$|\.)/,
  /[\/\-_](\d{4})(\d{2})(\d{2})(?:[\/\-_]|$|\.)/,
];

function extractDateFromText(text) {
  for (const re of TITLE_DATE_RES) {
    const m = text.match(re);
    if (m) {
      const y = +m[1], mo = +m[2], d = +(m[3] || '1');
      const dt = new Date(Date.UTC(y, mo - 1, d));
      if (!isNaN(dt.getTime()) && y >= 2015 && y <= 2030) return dt;
    }
  }
  return null;
}

function extractDateFromUrl(url) {
  for (const re of URL_DATE_RES) {
    const m = url.match(re);
    if (m) {
      const y = +m[1], mo = +m[2], d = +(m[3] || '1');
      const dt = new Date(Date.UTC(y, mo - 1, d));
      if (!isNaN(dt.getTime()) && y >= 2015 && y <= 2030) return dt;
    }
  }
  return null;
}

async function extractDateFromPage(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('xml')) return null;
    const html = await res.text();
    // Try meta tags
    const metaPatterns = [
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
      /<meta[^>]+name=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']datePublished["']/i,
      /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']publishdate["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']DC\.date["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']DC\.date\.created["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:article:published_time["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
    ];
    for (const re of metaPatterns) {
      const m = html.match(re);
      if (m) {
        const t = new Date(m[1]);
        if (!isNaN(t.getTime())) return t;
      }
    }
    // Try <time datetime="...">
    const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if (timeMatch) {
      const t = new Date(timeMatch[1]);
      if (!isNaN(t.getTime())) return t;
    }
    // Try JSON-LD
    const jsonLd = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (jsonLd) {
      const t = new Date(jsonLd[1]);
      if (!isNaN(t.getTime())) return t;
    }
    return null;
  } catch {
    return null;
  }
}

async function getItemDate(item) {
  // 1. published_at
  if (item.published_at) {
    const t = new Date(item.published_at);
    if (!isNaN(t.getTime())) return t;
  }
  // 2. title
  const fromTitle = extractDateFromText(item.title || '');
  if (fromTitle) return fromTitle;
  // 3. URL
  const fromUrl = extractDateFromUrl(item.url || '');
  if (fromUrl) return fromUrl;
  // 4. fetch page
  return await extractDateFromPage(item.url);
}

let totalBefore = 0, totalAfter = 0, totalDropped = 0, totalDated = 0, totalUndatable = 0;
const droppedByCo = {};

for (const slug of SLUGS) {
  const fp = join('data', `${slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;

  for (const c of data.companies) {
    totalBefore += c.news.length;
    // Process items in parallel batches
    const results = new Array(c.news.length);
    let idx = 0;
    async function worker() {
      while (idx < c.news.length) {
        const i = idx++;
        const item = c.news[i];
        const date = await getItemDate(item);
        results[i] = { date, item };
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, c.news.length) }, worker));

    const kept = [];
    let dropped = 0;
    for (const r of results) {
      if (r.date) {
        totalDated++;
        if (r.date < CUTOFF) {
          dropped++;
          continue;
        }
      } else {
        totalUndatable++;
      }
      kept.push(r.item);
    }
    if (dropped > 0) {
      console.log(`${slug}/${c.id}: dropped ${dropped} (kept ${kept.length}/${c.news.length})`);
      droppedByCo[`${slug}/${c.id}`] = dropped;
      touched = true;
    }
    c.news = kept;
    totalAfter += kept.length;
    totalDropped += dropped;
  }

  if (touched && !DRY) writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

console.log(`\n${DRY ? '[DRY] ' : ''}=== Summary ===`);
console.log(`Total before: ${totalBefore}`);
console.log(`Total after:  ${totalAfter}`);
console.log(`Dropped:      ${totalDropped}`);
console.log(`Dated items:  ${totalDated}`);
console.log(`Undatable (kept): ${totalUndatable}`);
if (Object.keys(droppedByCo).length) {
  console.log(`\nDropped by company:`);
  for (const [k, v] of Object.entries(droppedByCo)) console.log(`  ${k}: ${v}`);
}
