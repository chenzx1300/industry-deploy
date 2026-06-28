#!/usr/bin/env node
// Seed fallback_news from industries.json into data/<slug>.json
// Ensures every company has dated anchor news, even when Bing-scraped
// English news overwrote the baseline.
//
// Per skill rule: "After incremental update: re-seed fallback_news if
// scraped data overwrote it"
//
// Behavior:
//   1. If company not in data: append with all fallback_news as dated news
//   2. If company in data: add only fallback items whose URL is NOT
//      already in the company's news (dedup by URL)
//   3. published_at = extractDateFromTitle(title) so item passes
//      the 365-day stale-drop check
//
// Usage: node scripts/seed-fallbacks.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');

function safeHost(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch { return ''; }
}

function extractDate(title) {
  if (!title) return null;
  const m = title.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T00:00:00Z`;
  const c = title.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (c) return `${c[1]}-${c[2].padStart(2,'0')}-${c[3].padStart(2,'0')}T00:00:00Z`;
  return null;
}

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
let totalAdded = 0;
let totalRemoved = 0;

for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  let data;
  try { data = JSON.parse(readFileSync(fp, 'utf-8')); }
  catch { data = { slug: ind.slug, prompt: ind.prompt, generated_at: new Date().toISOString(), companies: [] }; }

  for (const c of ind.companies) {
    const fb = c.fallback_news || [];
    if (fb.length === 0) continue;

    const fbItems = fb.map(f => ({
      title: f.title || '',
      url: f.url || '',
      snippet: '',
      published_at: extractDate(f.title || ''),
      source: safeHost(f.url || ''),
    }));

    // Compute trusted URL set from fallback_news (these are hand-curated)
    const trustedUrls = new Set(fb.map(f => f.url || ''));
    // Also trust the company's own news_url + any URL on company's domain
    const ownDomain = (c.domain || c.news_url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

    let existing = data.companies.find(x => x.id === c.id);
    if (!existing) {
      data.companies.push({ ...c, news: fbItems });
      console.log(`  + ${ind.slug}/${c.id}: added with ${fbItems.length} fallback`);
      totalAdded += fbItems.length;
      continue;
    }

    // 1. Remove Bing-misclassified news (URL not on trusted list AND
    //    not on company's own domain). These are usually wrong-company
    //    matches (e.g. Bing thinks "ZTT" is the record label "Zang Tuum Tumb").
    const before = (existing.news || []).length;
    existing.news = (existing.news || []).filter(n => {
      const u = n.url || '';
      if (trustedUrls.has(u)) return true;  // trusted fallback
      try {
        const h = new URL(u).hostname.replace(/^www\./, '');
        if (ownDomain && (h === ownDomain || h.endsWith('.' + ownDomain))) return true;  // on own domain
        // Trusted news sources: keep general news domains
        if (/\.(reuters|bloomberg|scmp|forbes|cnn|yahoo|techcrunch|theinformation|wsj|ft\.com|nikkei|caixin|securities|sina|sohu|163|qq|eastmoney|thestocktiger|microsoft|apple|tesla|nvidia|amd|intel|cisco|ibm|google|amazon|meta|openai|anthropic|meta|foxconn|tsmc|huawei|byd|catl|tesla|continental|bosch|denso|nio|xpeng|li)/i.test(h)) return true;
      } catch {}
      return false;  // Bing-misclassified: drop
    });
    const removed = before - existing.news.length;
    if (removed > 0) {
      console.log(`  - ${ind.slug}/${c.id}: removed ${removed} misclassified Bing news`);
      totalRemoved += removed;
    }

    // 2. Inject fallback items whose URL is NOT already present
    const haveUrls = new Set((existing.news || []).map(n => n.url || ''));
    let added = 0;
    for (const it of fbItems) {
      if (!haveUrls.has(it.url)) {
        existing.news = existing.news || [];
        existing.news.push(it);
        added += 1;
        totalAdded += 1;
      }
    }
    if (added > 0) console.log(`  + ${ind.slug}/${c.id}: +${added} fallback (total now ${existing.news.length})`);
  }

  writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

console.log(`\n✓ Total fallback items seeded: ${totalAdded}`);
console.log(`✓ Total misclassified Bing news removed: ${totalRemoved}`);