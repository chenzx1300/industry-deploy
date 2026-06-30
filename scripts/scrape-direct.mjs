#!/usr/bin/env node
// Direct scraping for each company's official news page.
// Each site has a different HTML structure — this script tries generic
// patterns: <article>, <h2>/<h3> with date nearby, news cards, etc.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);
const CUTOFF = new Date('2025-06-30T00:00:00Z');
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SLUGS = ['semiconductor-industry','new-energy-vehicles-industry','carbon-fiber-industry','thermal-materials-industry','composite-insulator-industry','datacenter-cooling-industry'];

function extractDateFromText(text) {
  if (!text) return null;
  let m = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }
  m = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// Hard-blocked hostnames: never ingest as news sources.
// finance.yahoo.com / yahoo.com blocked per user policy (often blocked in CN,
// data quality is quote-only not primary news content).
// weixin.sogou.com blocked: aggregator, no reliable date.
// cninfo.com.cn blocked from Bing — handled by dedicated cninfo script.
const HARD_BLOCKED_HOSTNAMES = new Set([
  'finance.yahoo.com',
  'uk.finance.yahoo.com',
  'au.finance.yahoo.com',
  'ca.finance.yahoo.com',
  'yahoo.com',
  'weixin.sogou.com',
  'cninfo.com.cn',
]);

function isHardBlocked(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return HARD_BLOCKED_HOSTNAMES.has(host);
  } catch { return true; }
}

async function fetchHtml(url) {
  if (isHardBlocked(url)) return null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8' }, signal: AbortSignal.timeout(10000), redirect: 'follow' });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return null;
    return await r.text();
  } catch { return null; }
}

// Generic extractor: pull {title, url, date} from common news listing patterns
function extractFromHtml(html, baseUrl) {
  const items = [];
  // Pattern 1: <article> blocks with <a href> + <time>
  const articleRe = /<article[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([^<]{10,200})<\/a>[\s\S]*?(?:<time[^>]+datetime=["']([^"']+)["']|(\d{4})[-/](\d{1,2})[-/](\d{1,2})|(\d{4})年(\d{1,2})月(\d{1,2})日)?/gi;
  let m;
  while ((m = articleRe.exec(html)) !== null) {
    const url = m[1];
    const title = m[2].trim();
    let date = null;
    if (m[3]) date = new Date(m[3]);
    else if (m[4]) date = new Date(`${m[4]}-${m[5].padStart(2,'0')}-${m[6].padStart(2,'0')}`);
    else if (m[7]) date = new Date(`${m[7]}-${m[8].padStart(2,'0')}-${m[9].padStart(2,'0')}`);
    if (date && !isNaN(date.getTime())) {
      items.push({ title, url, date });
    }
  }
  // Pattern 2: list items with anchor + nearby date text
  const liRe = /<li[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([^<]{10,200})<\/a>[\s\S]{0,500}?(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/gi;
  while ((m = liRe.exec(html)) !== null) {
    const url = m[1];
    const title = m[2].trim();
    const date = extractDateFromText(m[3]);
    if (date && items.find(x => x.url === url) === undefined) {
      items.push({ title, url, date });
    }
  }
  // Pattern 3: div.news / div.card items
  const cardRe = /<div[^>]*class=["'][^"']*(?:news|card|item|article)[^"']*["'][\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([^<]{10,200})<\/a>[\s\S]{0,500}?(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/gi;
  while ((m = cardRe.exec(html)) !== null) {
    const url = m[1];
    const title = m[2].trim();
    const date = extractDateFromText(m[3]);
    if (date && items.find(x => x.url === url) === undefined) {
      items.push({ title, url, date });
    }
  }
  return items;
}

async function scrapeCompany(c, slug) {
  if (!c.news_url) return [];
  const html = await fetchHtml(c.news_url);
  if (!html) return [];
  let items = extractFromHtml(html, c.news_url);
  // Resolve relative URLs
  items = items.map(it => {
    try { it.url = new URL(it.url, c.news_url).href; } catch {}
    return it;
  });
  // Filter: drop hard-blocked sources and items before cutoff
  items = items.filter(it => it.url && !isHardBlocked(it.url) && it.date && it.date >= CUTOFF);
  // Dedup
  const seen = new Set();
  items = items.filter(it => {
    if (seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });
  return items;
}

for (const slug of SLUGS) {
  const fp = join(DATA_DIR, `${slug}.json`);
  if (!existsSync(fp)) continue;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;

  for (const c of data.companies) {
    if (c.news.length >= TARGET) continue;
    const need = TARGET - c.news.length;
    console.log(`\n▸ ${slug}/${c.id} (${c.name}): have ${c.news.length}, need ${need}`);
    const items = await scrapeCompany(c, slug);
    console.log(`  scraped: ${items.length}`);
    if (items.length === 0) continue;
    const seen = new Set(c.news.map(n => n.url));
    const now = new Date().toISOString();
    let added = 0;
    for (const it of items) {
      if (c.news.length >= TARGET) break;
      if (seen.has(it.url)) continue;
      seen.add(it.url);
      c.news.push({
        title: it.title,
        url: it.url,
        snippet: '',
        published_at: it.date.toISOString(),
        fetched_at: now,
        source: (() => { try { return new URL(it.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
      });
      added++;
    }
    console.log(`  ✓ added ${added} (now ${c.news.length}/${TARGET})`);
    touched = true;
  }

  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2));
}

console.log('\n=== Done ===');