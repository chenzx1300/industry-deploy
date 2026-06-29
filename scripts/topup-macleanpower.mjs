#!/usr/bin/env node
// Topup MacLean-Fogg from the correct news source: https://www.macleanpower.com/news
// Page structure: <article> blocks, each with <h2 class="entry-title"><a href=URL>TITLE</a></h2>
// and <time class="entry-date published" datetime=ISO>.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CUTOFF = new Date('2025-06-29T00:00:00Z');
const NEWS_URL = 'https://www.macleanpower.com/news';
const SLUG = 'composite-insulator-industry';

async function headOk(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } });
    return r.status >= 200 && r.status < 400;
  } catch { return false; }
}

async function fetchPage(url) {
  const r = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}

function extractNews(html) {
  // Find each <article> block, then within it:
  //   <h2 class="entry-title..."><a href="URL">TITLE</a></h2>
  //   <time class="entry-date published" datetime="ISO">
  const items = [];
  const articleRe = /<article[^>]*>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = articleRe.exec(html)) !== null) {
    const block = m[1];
    const linkMatch = block.match(/<h2[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/);
    if (!linkMatch) continue;
    const url = linkMatch[1];
    const title = linkMatch[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&hellip;/g, '...').replace(/&#8243;/g, '"').replace(/\s+/g, ' ').trim();
    const timeMatch = block.match(/<time[^>]+datetime=["']([^"']+)["']/);
    const date = timeMatch ? new Date(timeMatch[1]) : null;
    items.push({ title, url, date });
  }
  return items;
}

async function main() {
  const fp = join('data', `${SLUG}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const c = data.companies.find(x => x.id === 'macleanfogg');
  if (!c) throw new Error('macleanfogg not found');

  console.log(`▸ macleanfogg: have ${c.news.length}, need ${10 - c.news.length}`);

  const all = [];
  for (const u of [NEWS_URL, `${NEWS_URL}page/2/`, `${NEWS_URL}page/3/`]) {
    try {
      const html = await fetchPage(u);
      const items = extractNews(html);
      console.log(`  ${u}: ${items.length} items`);
      all.push(...items);
    } catch (e) {
      console.log(`  ${u}: error ${e.message}`);
    }
  }

  // Filter to past 1 year
  const recent = all.filter(i => i.date && !isNaN(i.date.getTime()) && i.date >= CUTOFF && i.title);
  console.log(`  recent (>=2025-06-29): ${recent.length}`);
  for (const r of recent) console.log(`    - ${r.date.toISOString().slice(0,10)} ${r.title.slice(0,70)} | ${r.url}`);

  // Dedupe
  const seen = new Set(c.news.map(n => n.url));
  const fresh = recent.filter(r => !seen.has(r.url));
  console.log(`  fresh: ${fresh.length}`);

  // Validate
  const validated = [];
  await Promise.all(fresh.map(async (r) => {
    const ok = await headOk(r.url);
    if (ok) validated.push(r);
  }));
  console.log(`  validated URLs: ${validated.length}`);

  const need = 10 - c.news.length;
  if (validated.length > 0) {
    const now = new Date().toISOString();
    const toAdd = validated.slice(0, need).map(v => ({
      title: v.title,
      url: v.url,
      snippet: '',
      published_at: v.date.toISOString(),
      fetched_at: now,
      source: 'macleanpower.com',
    }));
    c.news = [...c.news, ...toAdd];
    writeFileSync(fp, JSON.stringify(data, null, 2));
    console.log(`  ✓ added ${toAdd.length}, total now ${c.news.length}`);
  } else {
    console.log(`  ✗ no new items to add`);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
