#!/usr/bin/env node
// Direct fetch — manually add known real news URLs for Kingfa from news.qq.com.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Known real news URLs from Bing/news.qq.com searches for Kingfa
const KNOWN_NEWS = [
  'https://news.qq.com/rain/a/20251122A04ED600',
  'https://news.qq.com/rain/a/20250829A05V3B00',
  'https://news.qq.com/rain/a/20260630A06WK400',
  'https://news.qq.com/rain/a/20260630A06V2N00',
  'https://news.qq.com/rain/a/20260629A079BC00',
];

async function fetchMeta(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    let title = titleMatch ? titleMatch[1].trim() : '';
    title = title.replace(/_腾讯新闻$|_新浪财经$|_新浪网$|_网易$|-腾讯新闻$/, '');
    const md = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const snippet = md ? md[1].trim().slice(0, 250) : '';
    const urlDate = url.match(/\/(\d{4})(\d{2})(\d{2})/);
    const date = urlDate ? `${urlDate[1]}-${urlDate[2]}-${urlDate[3]}` : null;
    return { url, title, snippet, published_at: date };
  } catch { return null; }
}

async function main() {
  const SLUG = 'thermal-materials-industry';
  const fp = join('data', `${SLUG}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const c = data.companies.find(x => x.id === 'kingfa');
  console.log(`▸ ${c.name}: current ${c.news.length}`);

  const now = new Date().toISOString();
  const newItems = [];
  for (const url of KNOWN_NEWS) {
    const meta = await fetchMeta(url);
    if (!meta || !meta.title || meta.title.length < 8) continue;
    console.log(`  [${meta.published_at}] ${meta.title.slice(0, 60)}`);
    newItems.push({
      title: meta.title,
      url,
      snippet: meta.snippet,
      published_at: meta.published_at + 'T00:00:00Z',
      fetched_at: now,
      source: 'news.qq.com',
    });
  }

  // Replace bad items (older cninfo / placeholder titles) with real news
  const seen = new Set(c.news.map(n => n.url));
  const additions = newItems.filter(n => !seen.has(n.url));
  console.log(`  New from known URLs: ${additions.length}`);

  c.news = [...c.news, ...additions].sort((a, b) => new Date(b.published_at) - new Date(a.published_at)).slice(0, 10);
  writeFileSync(fp, JSON.stringify(data, null, 2));

  console.log(`\n✓ Kingfa: ${c.news.length}`);
  const src = {};
  c.news.forEach(n => { src[n.source] = (src[n.source] || 0) + 1; });
  console.log(`  Sources:`, src);
  for (const n of c.news) {
    console.log(`  [${n.published_at.slice(0,10)}] [${n.source.padEnd(15)}] ${n.title.slice(0,55)}`);
    console.log(`    S: ${n.snippet.slice(0, 80)}`);
  }
}

main().catch(err => { console.error('✗', err); process.exit(1); });