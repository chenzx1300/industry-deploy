#!/usr/bin/env node
// Scrape Kingfa official news site (kingfa.com.cn/portal/list/index/id/11.html)
// to replace cninfo-only announcements with real news articles.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CUTOFF = new Date('2025-06-29T00:00:00Z');  // 1 year ago
const TARGET = 10;

async function fetchList(listId) {
  const url = `https://www.kingfa.com.cn/portal/list/index/id/${listId}.html`;
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`list ${listId}: HTTP ${r.status}`);
  return await r.text();
}

async function fetchArticleBody(articleId, cid) {
  const url = `https://www.kingfa.com.cn/portal/article/index/id/${articleId}/cid/${cid}.html`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

// Parse the listing HTML — extract (article_id, cid, title, image_date) tuples.
// The image URL pattern is kfdoc/portal/YYYYMMDD/... and gives us the article date.
function parseListing(html) {
  const items = [];
  // Pattern: <a href="/portal/article/index/id/<id>/cid/<cid>.html"> ... <img ... src=".../kfdoc/portal/<YYYYMMDD>/..."/> ... <div class="text">TITLE</div>
  const blockRe = /<a[^>]+href="\/portal\/article\/index\/id\/(\d+)\/cid\/(\d+)\.html"[^>]*>\s*<img[^>]+src="[^"]*\/kfdoc\/portal\/(\d{8})\/[^"]*"[^>]*\/?>(?:[^<]|<(?!\/a>))*?<div class="text">([^<]+)<\/div>/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const [, id, cid, yyyymmdd, title] = m;
    const y = yyyymmdd.slice(0, 4), mo = yyyymmdd.slice(4, 6), d = yyyymmdd.slice(6, 8);
    const date = new Date(`${y}-${mo}-${d}T00:00:00Z`);
    if (isNaN(date.getTime())) continue;
    items.push({ id, cid, date, title: title.trim() });
  }
  return items;
}

// Extract first paragraph from article body for snippet
function parseSnippet(html) {
  // Try meta description first
  const md = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (md) return md[1].slice(0, 300);
  // Otherwise extract first <p> from article body
  const main = html.match(/<div[^>]+class=["'][^"']*detail[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (main) {
    const ps = main[1].match(/<p[^>]*>([\s\S]*?)<\/p>/g) || [];
    for (const p of ps) {
      const text = p.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (text.length > 30) return text.slice(0, 300);
    }
  }
  return '';
}

const SLUG = 'thermal-materials-industry';
const fp = join('data', `${SLUG}.json`);
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'kingfa');
if (!c) { console.error('kingfa not found'); process.exit(1); }

console.log(`▸ ${c.name}: current ${c.news.length} items, scraping official site...`);

// Try multiple list pages — main news (11) seems most active
const allItems = [];
for (const listId of [11, 5, 52, 46]) {
  try {
    const html = await fetchList(listId);
    const items = parseListing(html);
    console.log(`  list/${listId}: ${items.length} articles`);
    for (const it of items) allItems.push({ ...it, listId });
  } catch (e) {
    console.log(`  list/${listId}: ${e.message}`);
  }
}

// Dedup by article id, then filter to recent
const seen = new Set();
const unique = [];
for (const it of allItems) {
  if (seen.has(it.id)) continue;
  seen.add(it.id);
  unique.push(it);
}
const recent = unique.filter(it => it.date >= CUTOFF).sort((a, b) => b.date - a.date);
console.log(`  Total unique: ${unique.length}, recent (since ${CUTOFF.toISOString().slice(0,10)}): ${recent.length}`);

// Drop items that look like generic reports/PDFs (often just sustainability docs)
const isUsefulTitle = (t) => {
  const bad = /绿色工厂第三方评价报告|社会责任政策|可持续发展报告/;
  return !bad.test(t);
};
const useful = recent.filter(it => isUsefulTitle(it.title));
console.log(`  Useful: ${useful.length}`);

// Pick top TARGET, fetch body for snippet
const top = useful.slice(0, TARGET);
console.log(`\n=== Top ${top.length} picks ===`);
for (const it of top) {
  console.log(`  ${it.date.toISOString().slice(0,10)} [${it.id}] ${it.title.slice(0,60)}`);
}

// Fetch snippets in parallel
const fetched = await Promise.all(top.map(async (it) => {
  const body = await fetchArticleBody(it.id, it.cid);
  const snippet = body ? parseSnippet(body) : '';
  return { ...it, snippet };
}));

// Replace Kingfa news entirely
const now = new Date().toISOString();
c.news = fetched.map(it => ({
  title: it.title,
  url: `https://www.kingfa.com.cn/portal/article/index/id/${it.id}/cid/${it.cid}.html`,
  snippet: it.snippet,
  published_at: it.date.toISOString(),
  fetched_at: now,
  source: 'kingfa.com.cn',
}));
writeFileSync(fp, JSON.stringify(data, null, 2));
console.log(`\n✓ Kingfa: ${c.news.length} items from official site, all with real dates`);
for (const n of c.news) {
  console.log(`  - [${n.published_at.slice(0,10)}] ${n.title.slice(0,60)}`);
}