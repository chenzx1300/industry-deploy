#!/usr/bin/env node
// Fill from Google News RSS - use source URL as actual link (not Google News redirect)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);
const CUTOFF = new Date('2025-06-30T00:00:00Z');
const NOW = new Date().toISOString();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HARD_BLOCK = ['finance.yahoo.com', 'yahoo.com', 'weixin.sogou.com', 'cninfo.com.cn', 'tradingview.com', 'seekingalpha.com', 'morningstar.com', 'markets.businessinsider.com', 'stockanalysis.com', 'stocktwits.com'];

const QUERIES = {
  toray: 'Toray+Industries+2026',
  henkel: 'Henkel+press+2026',
  mmm: '3M+Company+2026+press+release',
  nio: 'NIO+delivery+2026+announce',
  vw: 'Volkswagen+Group+2026+press',
  li: 'Li+Auto+2026+announce',
  coolit: 'CoolIT+Systems+2026',
  ymtc: 'YMTC+Yangtze+Memory+2026',
  cxmt: 'CXMT+Changxin+Memory+2026',
  mitsubishi: 'Mitsubishi+Chemical+Group+2026+announce',
};

const ALIASES = {
  toray: ['Toray', '东丽', 'TORAY'],
  henkel: ['Henkel', '汉高'],
  mmm: ['3M', '3M Company'],
  nio: ['NIO', '蔚来', 'ES9', 'ET9', 'Onvo'],
  vw: ['Volkswagen', 'VW', '大众', 'Audi', 'Porsche', 'Bentley'],
  li: ['Li Auto', '理想', 'L9', 'L8', 'L7', 'L6'],
  coolit: ['CoolIT'],
  ymtc: ['YMTC', '长江存储', 'Yangtze Memory'],
  cxmt: ['CXMT', '长鑫存储', 'Changxin Memory', 'ChangXin'],
  mitsubishi: ['Mitsubishi Chemical', '三菱化学', 'Mitsubishi'],
};

function isRelevant(title, aliases) {
  const lower = (title || '').toLowerCase();
  for (const a of (aliases || [])) {
    if (lower.includes(a.toLowerCase())) return true;
    if (/[一-龥]/.test(a) && lower.includes(a.slice(0, 2))) return true;
  }
  return false;
}

function cleanTitle(t) {
  return (t || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function extractItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const title = cleanTitle((m[1].match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const sourceUrl = (m[1].match(/<source[^>]+url=["']([^"']+)["']/) || [])[1];
    const pub = (m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1];
    if (!title || !sourceUrl || !pub) continue;
    const d = new Date(pub);
    if (isNaN(d.getTime())) continue;
    items.push({ title, sourceUrl, date: d });
  }
  return items;
}

function dedupAdd(c, items, aliases) {
  const seen = new Set(c.news.map(n => n.url));
  let added = 0;
  for (const it of items) {
    if (c.news.length >= TARGET) break;
    if (!it.sourceUrl || seen.has(it.sourceUrl)) continue;
    if (HARD_BLOCK.some(b => it.sourceUrl.includes(b))) continue;
    if (aliases && !isRelevant(it.title, aliases)) continue;
    if (it.date < CUTOFF) continue;
    seen.add(it.sourceUrl);
    c.news.push({
      title: it.title,
      url: it.sourceUrl,
      snippet: '',
      published_at: it.date.toISOString(),
      fetched_at: NOW,
      source: (() => { try { return new URL(it.sourceUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
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
    const query = QUERIES[c.id];
    if (!query) continue;
    if (c.news.length >= TARGET) continue;
    const need = TARGET - c.news.length;
    console.log(`\n▸ ${ind.slug}/${c.id} (${c.name}): have ${c.news.length}, need ${need}`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      const xml = await r.text();
      const items = extractItems(xml);
      console.log(`  Google News: ${items.length} items`);
      const a = dedupAdd(c, items, ALIASES[c.id]);
      console.log(`  ✓ added ${a} (now ${c.news.length})`);
      if (a > 0) touched = true;
    } catch (e) {
      console.log(`  ✗ error: ${e.message}`);
    }
  }
  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2));
}
console.log('\n=== Done ===');
