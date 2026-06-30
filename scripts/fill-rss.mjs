#!/usr/bin/env node
// RSS-based fill for companies with official feeds (macleanpower, etc.)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);
const CUTOFF = new Date('2025-06-30T00:00:00Z');
const NOW = new Date().toISOString();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const RSS_FEEDS = {
  macleanfogg: 'https://www.macleanpower.com/feed',
  mmm: 'https://news.3m.com/press-releases?pagetemplate=rss',
};

const HARD_BLOCK = ['finance.yahoo.com', 'yahoo.com', 'weixin.sogou.com', 'cninfo.com.cn', 'tradingview.com'];

function parseRssItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const title = (m[1].match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (m[1].match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pub = (m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    // Strip CDATA
    const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const cleanLink = link.trim();
    if (!cleanTitle || !cleanLink) continue;
    const d = new Date(pub);
    if (isNaN(d.getTime())) continue;
    items.push({ title: cleanTitle, url: cleanLink, date: d });
  }
  return items;
}

function dedupAdd(c, items) {
  const seen = new Set(c.news.map(n => n.url));
  let added = 0;
  for (const it of items) {
    if (c.news.length >= TARGET) break;
    if (!it.url || seen.has(it.url)) continue;
    if (it.date < CUTOFF) continue;
    if (HARD_BLOCK.some(b => it.url.includes(b))) continue;
    seen.add(it.url);
    c.news.push({
      title: it.title,
      url: it.url,
      snippet: '',
      published_at: it.date.toISOString(),
      fetched_at: NOW,
      source: (() => { try { return new URL(it.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
    });
    added++;
  }
  return added;
}

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));

for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  if (!existsSync(fp)) continue;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;
  for (const c of data.companies) {
    const feed = RSS_FEEDS[c.id];
    if (!feed) continue;
    if (c.news.length >= TARGET) continue;
    const need = TARGET - c.news.length;
    console.log(`\n▸ ${ind.slug}/${c.id} (${c.name}): have ${c.news.length}, need ${need}`);
    try {
      const r = await fetch(feed, { headers: { 'User-Agent': UA } });
      const xml = await r.text();
      const items = parseRssItems(xml);
      console.log(`  RSS items: ${items.length}`);
      const a = dedupAdd(c, items);
      console.log(`  ✓ added ${a} (now ${c.news.length})`);
      if (a > 0) touched = true;
    } catch (e) {
      console.log(`  ✗ error: ${e.message}`);
    }
  }
  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2));
}
console.log('\n=== Done ===');
