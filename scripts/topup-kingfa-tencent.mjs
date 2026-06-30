#!/usr/bin/env node
// Fetch real Kingfa news from Tencent News (news.qq.com) and other accessible
// Chinese news sources to replace cninfo announcements.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CUTOFF = new Date('2025-06-29T00:00:00Z');

async function searchSogouForArticles(query, maxPages = 3) {
  // Sogou news search — different from web search
  const articles = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `https://news.sogou.com/news?query=${encodeURIComponent(query)}&page=${page}&mode=0&sort=1&time=0`;
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://news.sogou.com/' }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) break;
      const html = await r.text();
      // Sogou news structure
      const itemRe = /<h3[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>\s*<\/h3>[\s\S]*?<p class="txt-info">([^<]*)<\/p>/g;
      let m;
      while ((m = itemRe.exec(html)) !== null) {
        articles.push({ url: m[1], title: m[2].trim(), snippet: m[3].trim() });
      }
      if (html.indexOf('下一页') === -1) break;
    } catch { break; }
  }
  return articles;
}

async function searchTencent(query, maxResults = 20) {
  // news.qq.com uses a JSON-like API
  const url = `https://r.inews.qq.com/getQQNewsUnreadList?chlid=news_news_inews&page=0&num=${maxResults}&word=${encodeURIComponent(query)}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://news.qq.com/' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.newslist || []).map(it => ({
      url: it.url || it.surl,
      title: it.title,
      snippet: it.abstract || '',
      date: it.timestamp ? new Date(it.timestamp * 1000).toISOString() : null,
      source: it.media || 'qq.com',
    }));
  } catch { return []; }
}

async function searchQQDirect(query) {
  // news.qq.com search via different endpoint
  const url = `https://search.inews.qq.com/cgi-bin/inewssearch/search?query=${encodeURIComponent(query)}&action=1&sort=1&num=20`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://news.qq.com/' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const html = await r.text();
    const items = [];
    const re = /"title":"([^"]+)"[^}]*"media":"([^"]*)"[^}]*"url":"(https?:\/\/[^"]+)"[^}]*"timestamp":(\d+)/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      items.push({
        title: m[1].replace(/<[^>]+>/g, '').trim(),
        source: m[2],
        url: m[3].replace(/\\\//g, '/'),
        date: new Date(parseInt(m[4]) * 1000).toISOString(),
      });
    }
    return items;
  } catch { return []; }
}

async function fetchQQArticle(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://news.qq.com/' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return '';
    const html = await r.text();
    const snippet = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if (snippet) return snippet[1].trim().slice(0, 250);
    // Try to extract first paragraph
    const ps = html.match(/<p[^>]*>([\s\S]*?)<\/p>/g) || [];
    for (const p of ps) {
      const t = p.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (t.length > 50 && !t.includes('登录') && !t.includes('注册')) return t.slice(0, 250);
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

  // Try multiple searches
  const allArticles = new Map();

  for (const q of ['金发科技', '金发科技 Kingfa', '金发科技 600143', '金发科技 财报']) {
    console.log(`\n  Tencent search: ${q}`);
    const items = await searchQQDirect(q);
    console.log(`    → ${items.length} items`);
    for (const it of items) {
      if (it.url && !allArticles.has(it.url) && /news\.qq\.com|inews\.qq\.com/.test(it.url)) {
        allArticles.set(it.url, it);
      }
    }
  }

  console.log(`\n  Total unique articles: ${allArticles.size}`);

  // Filter to recent
  const recent = [...allArticles.values()]
    .filter(it => it.date && new Date(it.date) >= CUTOFF)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  console.log(`  Recent (>= ${CUTOFF.toISOString().slice(0,10)}): ${recent.length}`);

  // Filter to actually about Kingfa
  const kingfaArticles = recent.filter(it => {
    const t = (it.title || '').toLowerCase();
    return /金发|kingfa|600143/.test(t);
  });
  console.log(`  About Kingfa: ${kingfaArticles.length}`);

  for (const it of kingfaArticles.slice(0, 15)) {
    console.log(`    [${(it.date || '').slice(0,10)}] ${it.title.slice(0,70)}`);
    console.log(`      ${it.url.slice(0, 100)}`);
  }

  // Fetch snippets
  const withSnippets = [];
  for (const it of kingfaArticles.slice(0, 10)) {
    const snippet = await fetchQQArticle(it.url);
    withSnippets.push({ ...it, snippet });
  }

  // Add to data, sort, keep top 10
  const seen = new Set(c.news.map(n => n.url));
  const now = new Date().toISOString();
  const additions = withSnippets
    .filter(it => !seen.has(it.url))
    .map(it => ({
      title: it.title,
      url: it.url,
      snippet: it.snippet,
      published_at: it.date || now,
      fetched_at: now,
      source: it.source || 'qq.com',
    }));

  c.news = [...c.news, ...additions].sort((a, b) => new Date(b.published_at) - new Date(a.published_at)).slice(0, 10);
  writeFileSync(fp, JSON.stringify(data, null, 2));

  console.log(`\n✓ Kingfa: ${c.news.length} items (added ${additions.length})`);
  for (const n of c.news) {
    console.log(`  [${n.published_at.slice(0,10)}] [${n.source}] ${n.title.slice(0,60)}`);
  }
}

main().catch(err => { console.error('✗', err); process.exit(1); });