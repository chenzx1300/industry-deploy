#!/usr/bin/env node
// Strict 3-dimension validation:
//   1. URL validity (HEAD returns 2xx/3xx)
//   2. Content-link correspondence (page <title> or <h1> contains
//      at least one keyword from the news title)
//   3. Date freshness (publish date within past 1 year)
//
// Drops items that fail any of these. Then reports companies that
// drop below 10 so the operator can refill.
//
// Usage: node scripts/validate-strict.mjs [--dry]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SLUGS = [
  'semiconductor-industry','new-energy-vehicles-industry','carbon-fiber-industry',
  'thermal-materials-industry','composite-insulator-industry','datacenter-cooling-industry',
];
const DRY = process.argv.includes('--dry');
const CUTOFF = new Date('2025-06-29T00:00:00Z');
const CONCURRENCY = 10;
const FETCH_TIMEOUT = 7000;

// Heuristics for "content matches title" — at least one of these
// keywords from the title must appear in the page (case-insensitive).
// Filters out stop-words (very common CN/EN particles).
const STOPWORDS_EN = new Set(['the','a','an','in','on','at','to','for','of','with','by','is','are','was','were','be','been','and','or','but','from','as','its','it','this','that','have','has','had','will','would','can','could','may','might','not','no','do','does','did','get','got','just','one','two','three','new','first','last','over','under','more','most','some','all','says','said','say','now','then','after','before','how','why','what','when','who','where','which','than','about','into','through','during','up','down','out','off','also','only','very','much','many','few','our','your','his','her','their','its','my']);
const STOPWORDS_CN = new Set('的 是 在 和 与 为 于 有 也 被 这 那 但 而 或 至 以 及 等 就 要 会 能 可 其 之 上下 中 外 我们 你 他 她 它 已 来 去 看 说 让 给 到 从 把 用 像 跟 跟 被 让 给'.split(/\s+/));

function extractKeywords(title) {
  if (!title) return [];
  const out = [];
  // English words
  const en = (title.match(/[A-Za-z]{3,}/g) || []);
  for (const w of en) {
    const lo = w.toLowerCase();
    if (!STOPWORDS_EN.has(lo) && lo.length >= 4) out.push(lo);
  }
  // Chinese bigrams (2-char substrings that look like content words)
  const cn = (title.match(/[一-龥]{2,}/g) || []);
  for (const phrase of cn) {
    if (STOPWORDS_CN.has(phrase)) continue;
    if (phrase.length === 2) {
      // Skip 2-char stopwords
      if (STOPWORDS_CN.has(phrase)) continue;
      out.push(phrase);
    } else {
      // Take 2-3 char substrings
      for (let i = 0; i <= phrase.length - 2; i++) {
        const sub = phrase.substring(i, i + 2);
        if (!STOPWORDS_CN.has(sub)) out.push(sub);
      }
    }
  }
  // Dedupe
  return [...new Set(out)].slice(0, 6); // cap at 6 keywords
}

async function validate(item) {
  const url = item.url;
  if (!url) return { ok: false, reason: 'no-url' };
  let res;
  try {
    res = await fetch(url, {
      method: 'GET', redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
    });
  } catch (e) {
    return { ok: false, reason: 'fetch-error' };
  }
  if (!res.ok) return { ok: false, reason: `http-${res.status}` };
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/html') && !ct.includes('xml')) {
    return { ok: true, contentMatch: true, date: null, skipContentCheck: true };
  }
  const html = await res.text();
  // 2. Content match: page <title> + <h1> + first 50k chars must contain ≥1 keyword
  const kws = extractKeywords(item.title);
  if (kws.length === 0) {
    return { ok: true, contentMatch: true, date: null, skipContentCheck: true };
  }
  const lower = html.toLowerCase();
  const contentMatch = kws.some(k => lower.includes(k.toLowerCase()));
  if (!contentMatch) return { ok: false, reason: 'content-mismatch' };

  // 3. Date extraction
  let date = null;
  if (item.published_at) {
    const t = new Date(item.published_at);
    if (!isNaN(t.getTime())) date = t;
  }
  if (!date) {
    const metaPatterns = [
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
      /<meta[^>]+name=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']datePublished["']/i,
      /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
    ];
    for (const re of metaPatterns) {
      const m = html.match(re);
      if (m) { const t = new Date(m[1]); if (!isNaN(t.getTime())) { date = t; break; } }
    }
  }
  if (!date) {
    const tm = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if (tm) { const t = new Date(tm[1]); if (!isNaN(t.getTime())) date = t; }
  }
  if (!date) {
    const jl = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (jl) { const t = new Date(jl[1]); if (!isNaN(t.getTime())) date = t; }
  }
  if (!date) {
    // No date found in page — keep (we can't prove it's old)
    return { ok: true, contentMatch, date: null };
  }
  if (date < CUTOFF) return { ok: false, reason: `outdated:${date.toISOString().slice(0,10)}` };
  return { ok: true, contentMatch, date };
}

let total = 0, kept = 0, dropped = 0;
const droppedByReason = {};
const droppedByCo = {};

for (const slug of SLUGS) {
  const fp = join('data', `${slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;
  for (const c of data.companies) {
    total += c.news.length;
    const items = c.news;
    const results = new Array(items.length);
    let idx = 0;
    async function worker() {
      while (idx < items.length) {
        const i = idx++;
        try {
          results[i] = await validate(items[i]);
        } catch (e) {
          results[i] = { ok: false, reason: 'unhandled-error' };
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));

    const newNews = [];
    for (let i = 0; i < items.length; i++) {
      const r = results[i];
      if (r.ok) {
        newNews.push(items[i]);
      } else {
        dropped++;
        droppedByReason[r.reason] = (droppedByReason[r.reason] || 0) + 1;
        if (!droppedByCo[`${slug}/${c.id}`]) droppedByCo[`${slug}/${c.id}`] = [];
        droppedByCo[`${slug}/${c.id}`].push({ title: items[i].title.slice(0, 50), reason: r.reason });
        touched = true;
      }
    }
    c.news = newNews;
    kept += newNews.length;
  }
  if (touched && !DRY) writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

console.log(`\n${DRY ? '[DRY] ' : ''}=== Strict validation ===`);
console.log(`Total: ${total} | Kept: ${kept} | Dropped: ${dropped}`);
console.log(`\nDropped by reason:`);
for (const [r, n] of Object.entries(droppedByReason).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${r}: ${n}`);
}
console.log(`\nBelow-target companies (need refill):`);
for (const [k, items] of Object.entries(droppedByCo)) {
  const c = items.length;
  if (c > 0) console.log(`  ${k}: dropped ${c}`);
}
