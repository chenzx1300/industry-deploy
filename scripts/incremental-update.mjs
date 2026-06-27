#!/usr/bin/env node
// Incremental news update.
// Reads data/<slug>.json as the knowledge baseline.
// Calls buildNewsItems() per company, then merges new items onto the
// baseline by URL+title dedup. Keeps the most recent PER_COMPANY items
// per company (newest first, sorted by published_at or fetched_at).
//
// Output: writes updated data/<slug>.json + data/manifest.json
//         + data/latest-build.json (does NOT render HTML — run
//         scripts/render-from-json.mjs after this).
//
// Usage: node scripts/incremental-update.mjs [<slug>...]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildNewsItems } from '../src/lib/news-scraper.mjs';
import { addToManifest } from '../src/pipeline/manifest.mjs';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const PER_COMPANY = 10;
const MAX_AGE_DAYS = 90;            // news older than this is dropped from baseline
const STALE_DROP_DAYS = 365;        // companies with no dated news in this window are removed
const MIN_DATED_NEWS = 1;           // ...unless they have at least this many recent dated news items

function isoTimeOrNull(d) {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

// Extract a best-effort date from the title (handles 2026-06-15, 2026年6月15日, 2025).
function extractDateFromTitle(title) {
  if (!title) return null;
  let m = title.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return new Date(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T00:00:00Z`);
  m = title.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m) return new Date(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T00:00:00Z`);
  m = title.match(/(20\d{2})/);
  if (m) return new Date(`${m[1]}-01-01T00:00:00Z`);
  return null;
}

// Best-known publication time for a news item.
function itemTime(n) {
  return isoTimeOrNull(n.published_at)
      || isoTimeOrNull(extractDateFromTitle(n.title))
      || isoTimeOrNull(n.fetched_at);
}

function normalizeUrl(u) {
  try {
    const p = new URL(u);
    // strip tracking query params
    const drop = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref','fbclid','gclid'];
    for (const k of drop) p.searchParams.delete(k);
    return p.toString().replace(/\/$/, '');
  } catch { return u || ''; }
}

function mergeCompanyNews(existing, fresh) {
  // Dedup key: normalized URL, fallback to lowercased title
  const seen = new Set();
  const merged = [];
  const isDup = (item) => {
    const k = 'u:' + normalizeUrl(item.url);
    if (seen.has(k)) return true;
    const k2 = 't:' + (item.title || '').toLowerCase().trim();
    if (seen.has(k2)) return true;
    seen.add(k); seen.add(k2);
    return false;
  };
  // Fresh first (newest priority), then existing baseline.
  for (const item of fresh) {
    if (isDup(item)) continue;
    merged.push(item);
  }
  for (const item of existing) {
    if (isDup(item)) continue;
    merged.push(item);
  }
  // Sort by best-known date desc.
  merged.sort((a, b) => {
    const ta = itemTime(a);
    const tb = itemTime(b);
    if (ta && tb) return tb.localeCompare(ta);
    if (ta && !tb) return -1;
    if (!ta && tb) return 1;
    return 0;
  });
  // Drop ancient dated entries; undated entries are kept (they may be fresh — we just don't know).
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400 * 1000;
  const kept = merged.filter(n => {
    const t = itemTime(n);
    return !t || new Date(t).getTime() >= cutoff;
  });
  return kept.slice(0, PER_COMPANY);
}

// Return true if this company's news list has at least MIN_DATED_NEWS items
// whose best-known time is within STALE_DROP_DAYS. Companies with no
// dated recent news are considered stale and removed from the industry.
function isCompanyFresh(news) {
  if (!Array.isArray(news) || news.length === 0) return false;
  const cutoff = Date.now() - STALE_DROP_DAYS * 86400 * 1000;
  const recent = news.filter(n => {
    const t = itemTime(n);
    return t && new Date(t).getTime() >= cutoff;
  });
  return recent.length >= MIN_DATED_NEWS;
}

async function runOne(industry) {
  const slug = industry.slug;
  const fp = join(DATA_DIR, slug + '.json');
  let baseline;
  try { baseline = JSON.parse(readFileSync(fp, 'utf-8')); }
  catch { baseline = { slug, prompt: industry.prompt, generated_at: new Date().toISOString(), companies: [] }; }

  const byCo = new Map(baseline.companies.map(c => [c.id, c]));

  let totalKept = 0, totalAdded = 0;
  const results = [];
  const droppedStale = [];
  for (const c of industry.companies) {
    // Pre-seed baseline with fallback_news (from industries.json) — these are
    // manual entries the user curated. They ensure companies stay fresh even
    // when the scraper times out on slow/blocked sites.
    const existing = (byCo.get(c.id)?.news) || [];
    const fallbackAsItems = (c.fallback_news || []).map(n => ({
      ...n,
      published_at: extractDateFromTitle(n.title) || null,
      snippet: '',
      source: '',
    }));
    const baseline = [...existing, ...fallbackAsItems.filter(f => !existing.some(e => normalizeUrl(e.url) === normalizeUrl(f.url)))];

    let fresh = [];
    const PER_COMPANY_TIMEOUT_MS = 45_000; // hard cap per company (scrape + bing fallback)
    try {
      fresh = await Promise.race([
        buildNewsItems([], c.name, c.news_url, PER_COMPANY, {
          siteDomain: c.domain,
          fallbackNews: c.fallback_news,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`scrape timeout ${PER_COMPANY_TIMEOUT_MS}ms`)), PER_COMPANY_TIMEOUT_MS)
        ),
      ]);
    } catch (err) {
      console.error(`  ⚠ ${c.name}: ${err.message} — keeping baseline`);
    }
    const before = existing.length;
    const merged = mergeCompanyNews(baseline, fresh);
    const added = merged.filter(m => !baseline.some(e => normalizeUrl(e.url) === normalizeUrl(m.url))).length;
    // Stale drop: no dated news in last STALE_DROP_DAYS → drop company entirely
    if (!isCompanyFresh(merged)) {
      droppedStale.push(c.id);
      console.log(`  · ${c.name}: STALE (no dated news in last ${STALE_DROP_DAYS} days) — DROPPED`);
      continue;
    }
    totalAdded += added;
    totalKept += merged.length;
    results.push({ ...c, news: merged });
    console.log(`  · ${c.name}: kept ${merged.length} (${before} baseline + ${added} new)`);
  }

  const data = {
    slug,
    prompt: industry.prompt,
    generated_at: new Date().toISOString(),
    companies: results,
  };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');

  await addToManifest(DATA_DIR, {
    slug, prompt: industry.prompt,
    company_count: results.length,
    news_count: totalKept,
    generated_at: data.generated_at,
  });

  return { slug, prompt: industry.prompt, news_count: totalKept, total_companies: results.length, added: totalAdded, dropped: droppedStale };
}

async function main() {
  const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  let industries = config.industries || [];
  const filterSlugs = process.argv.slice(2);
  if (filterSlugs.length) industries = industries.filter(i => filterSlugs.includes(i.slug));

  console.log(`▸ Incremental update for ${industries.length} industries\n`);
  const summary = [];
  for (const ind of industries) {
    console.log(`▸ ${ind.slug}`);
    try {
      summary.push({ ...(await runOne(ind)), ok: true });
    } catch (err) {
      console.error(`  ✗ ${ind.slug}: ${err.message}`);
      summary.push({ slug: ind.slug, prompt: ind.prompt, ok: false, error: err.message });
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(join(DATA_DIR, 'latest-build.json'),
    JSON.stringify({ date: today, results: summary }, null, 2), 'utf-8');
  console.log(`\n✓ Done. Summary → data/latest-build.json`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => { console.error('✗ Fatal:', err); process.exit(1); });