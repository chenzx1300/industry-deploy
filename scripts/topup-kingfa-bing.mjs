#!/usr/bin/env node
// Bing search scraper for Kingfa news. Uses cn.bing.com which works in CN.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const CUTOFF = new Date('2025-06-29T00:00:00Z');

async function bingSearch(query) {
  const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-CN&cc=cn&count=30`;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'identity',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return [];
    return await r.text();
  } catch { return ''; }
}

function parseBing(html) {
  const items = [];
  // Bing news results: <li class="b_algo"> with h2 > a, then a paragraph
  const algoRe = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = algoRe.exec(html)) !== null) {
    const block = m[1];
    const linkMatch = block.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;
    const url = linkMatch[1];
    const title = linkMatch[2].replace(/<[^>]+>/g, '').replace(/<!--[^>]+-->/g, '').trim();
    // Skip non-news domains
    if (!url || /bing\.com|microsoft\.com|go\.microsoft|login\.live|account\.microsoft|aka\.ms|kingfa\.com\.cn\/$|kingfa\.com\.cn\/aboutus/.test(url)) continue;
    const paraMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const snippet = paraMatch ? paraMatch[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim() : '';
    if (title.length < 8 || title.length > 250) continue;
    items.push({ url, title, snippet });
  }
  return items;
}

async function fetchArticleSnippet(url) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return '';
    const html = await r.text();
    const md = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if (md) return md[1].trim().slice(0, 250);
    const ps = html.match(/<p[^>]*>([\s\S]*?)<\/p>/g) || [];
    for (const p of ps) {
      const t = p.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (t.length > 50 && !/登录|注册|cookie|隐私/.test(t)) return t.slice(0, 250);
    }
    return '';
  } catch { return ''; }
}

async function main() {
  const SLUG = 'thermal-materials-industry';
  const fp = join('data', `${SLUG}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const c = data.companies.find(x => x.id === 'kingfa');
  if (!c) { console.error('kingfa not found'); process.exit(1); }
  console.log(`▸ ${c.name}: current ${c.news.length} items`);

  const allArticles = new Map();
  const queries = ['金发科技', '金发科技 财报', '金发科技 公告', '金发科技 工厂', '金发科技 海外', '金发科技 投资', '金发科技 研发', '金发科技 600143', 'Kingfa 金发'];
  for (const q of queries) {
    console.log(`  Bing: ${q}`);
    const html = await bingSearch(q);
    const items = parseBing(html);
    console.log(`    → ${items.length} results`);
    for (const it of items) {
      if (!allArticles.has(it.url)) allArticles.set(it.url, it);
    }
  }
  console.log(`  Total unique: ${allArticles.size}`);

  // Filter: about Kingfa + news domain
  const kingfaArticles = [...allArticles.values()].filter(it => {
    const t = (it.title || '') + ' ' + (it.snippet || '');
    return /金发|kingfa|600143/.test(t);
  });
  console.log(`  About Kingfa: ${kingfaArticles.length}`);

  // Show all
  for (const it of kingfaArticles) {
    console.log(`    - ${it.title.slice(0, 70)}`);
    console.log(`      ${it.url.slice(0, 100)}`);
  }

  // Try to extract date from URL or by fetching
  console.log('\nFetching snippets...');
  const enriched = [];
  for (const it of kingfaArticles.slice(0, 20)) {
    if (!it.snippet) it.snippet = await fetchArticleSnippet(it.url);
    // Try to extract date from URL
    let date = null;
    const dateMatch = it.url.match(/\/(\d{4})(\d{2})(\d{2})/);
    if (dateMatch) date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    enriched.push({ ...it, published_at: date });
  }

  // Filter to recent (where we have dates)
  const recent = enriched.filter(it => it.published_at && new Date(it.published_at) >= CUTOFF);
  console.log(`\n  Recent (>= ${CUTOFF.toISOString().slice(0,10)}): ${recent.length}`);

  // Skip non-news domains
  const newsWhitelist = /news\.qq\.com|inews\.qq\.com|finance\.sina\.com\.cn|stcn\.com|cnstock\.com|caixin\.com|nbd\.com\.cn|cls\.cn|yicai\.com|wallstreetcn\.com|21jingji\.com|huxiu\.com|36kr\.com|jiemian\.com|ithome\.com|techweb\.com\.cn|donews\.com|leiphone\.com|pedaily\.cn|gasgoo\.com|chemnet\.com|plas\.com|plasticsnews\.com|chem1\.com/;
  const newsOnly = recent.filter(it => newsWhitelist.test(it.url));
  console.log(`  News sites only: ${newsOnly.length}`);

  for (const it of newsOnly) {
    console.log(`    [${it.published_at}] ${it.title.slice(0, 70)}`);
    console.log(`      ${it.url.slice(0, 100)}`);
  }

  // Add to data — replace cninfo where possible
  const seen = new Set(c.news.map(n => n.url));
  const now = new Date().toISOString();
  const additions = newsOnly
    .filter(it => !seen.has(it.url))
    .map(it => ({
      title: it.title,
      url: it.url,
      snippet: it.snippet || '',
      published_at: it.published_at + 'T00:00:00Z',
      fetched_at: now,
      source: (() => { try { return new URL(it.url).hostname.replace(/^www\./, ''); } catch { return 'bing.com'; } })(),
    }));

  c.news = [...c.news, ...additions].sort((a, b) => new Date(b.published_at) - new Date(a.published_at)).slice(0, 10);
  writeFileSync(fp, JSON.stringify(data, null, 2));

  console.log(`\n✓ Kingfa: ${c.news.length} items (added ${additions.length})`);
  const srcCount = {};
  c.news.forEach(n => { srcCount[n.source] = (srcCount[n.source] || 0) + 1; });
  console.log(`  Sources:`, srcCount);
  for (const n of c.news) {
    console.log(`  [${n.published_at.slice(0,10)}] [${n.source}] ${n.title.slice(0,55)}`);
  }
}

main().catch(err => { console.error('✗', err); process.exit(1); });