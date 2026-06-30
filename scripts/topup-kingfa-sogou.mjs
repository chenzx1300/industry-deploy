#!/usr/bin/env node
// Sogou web search scraper for Kingfa. Sogou returns Tencent News articles
// (view.inews.qq.com) with real Chinese news about the company.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CUTOFF = new Date('2025-06-29T00:00:00Z');

async function searchSogou(query, maxPages = 5) {
  const articles = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://www.sogou.com/web?query=${encodeURIComponent(query)}&page=${page}`;
    let html;
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, 'Referer': 'https://www.sogou.com/' },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) break;
      html = await r.text();
    } catch { break; }
    // Pattern: <h4 ...><a href="https://view.inews.qq.com/a/YYYYMMDD_ID?..." class="font-weight fz-title text-default"><em>TITLE</em></a></h4>
    // followed by <a class="star-wiki text-default" href="...">SNIPPET</a>
    // followed by <a ... class="my-doc-space">SOURCE</a><span class="my-doc-space">DATE_RELATIVE</span>
    const titleRe = /<h4[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]+class="font-weight fz-title[^"]*"[^>]*>([^<]+(?:<em>[^<]+<\/em>[^<]*)*?)<\/a>\s*<\/h4>/g;
    let m;
    const titles = [];
    while ((m = titleRe.exec(html)) !== null) {
      const titleClean = m[2].replace(/<[^>]+>/g, '').replace(/<!--[^>]+-->/g, '').trim();
      titles.push({ url: m[1].split('?')[0], title: titleClean });
    }
    const snippetRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]+class="star-wiki[^"]*"[^>]*>([^<]+(?:<em>[^<]+<\/em>[^<]*)*?)<\/a>/g;
    while ((m = snippetRe.exec(html)) !== null) {
      const urlClean = m[1].split('?')[0];
      const snippetClean = m[2].replace(/<[^>]+>/g, '').replace(/<!--[^>]+-->/g, '').trim();
      const t = titles.find(x => x.url === urlClean);
      if (t) t.snippet = snippetClean;
    }
    const srcRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]+class="my-doc-space"[^>]*>([^<]+)<\/a>\s*<span[^>]+class="my-doc-space"[^>]*>([^<]+)<\/span>/g;
    while ((m = srcRe.exec(html)) !== null) {
      const urlClean = m[1].split('?')[0];
      const t = titles.find(x => x.url === urlClean);
      if (t) {
        t.source = m[2].trim();
        t.dateRelative = m[3].trim();
      }
    }
    for (const t of titles) {
      // Extract date from URL like /a/20260630A06WK400
      const dateMatch = t.url.match(/\/a\/(\d{4})(\d{2})(\d{2})/);
      if (dateMatch) {
        t.published_at = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T00:00:00Z`).toISOString();
      }
      articles.push(t);
    }
    if (!html.includes('下一页')) break;
  }
  return articles;
}

async function main() {
  const SLUG = 'thermal-materials-industry';
  const fp = join('data', `${SLUG}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const c = data.companies.find(x => x.id === 'kingfa');
  if (!c) { console.error('kingfa not found'); process.exit(1); }
  console.log(`▸ ${c.name}: current ${c.news.length} items`);

  // Search queries
  const queries = ['金发科技 新闻', '金发科技 财报', '金发科技 公告', '金发科技 600143', '金发科技 工厂'];
  const allArticles = new Map();
  for (const q of queries) {
    console.log(`\n  Sogou search: ${q}`);
    const items = await searchSogou(q, 3);
    console.log(`    → ${items.length} items`);
    for (const it of items) {
      if (!allArticles.has(it.url)) allArticles.set(it.url, it);
    }
  }
  console.log(`\n  Total unique: ${allArticles.size}`);

  // Filter to actual news about Kingfa (title or snippet mentions 金发)
  const kingfaArticles = [...allArticles.values()].filter(it => {
    const t = (it.title || '') + ' ' + (it.snippet || '');
    return /金发|kingfa|600143/.test(t);
  });
  console.log(`  About Kingfa: ${kingfaArticles.length}`);

  // Filter to recent
  const recent = kingfaArticles.filter(it => it.published_at && new Date(it.published_at) >= CUTOFF);
  console.log(`  Recent (>= ${CUTOFF.toISOString().slice(0,10)}): ${recent.length}`);

  recent.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  console.log(`\n  Top candidates:`);
  for (const it of recent.slice(0, 15)) {
    console.log(`    [${(it.published_at || '').slice(0,10)}] [${it.source || '?'}] ${it.title.slice(0,60)}`);
    console.log(`      ${(it.snippet || '').slice(0, 100)}`);
  }

  // Build new Kingfa items: prefer news.qq.com sources, then official site, then cninfo
  const seen = new Set(c.news.map(n => n.url));
  const now = new Date().toISOString();
  const newsArticles = recent
    .filter(it => /news\.qq\.com|inews\.qq\.com|kingfa\.com\.cn|finance\.sina\.com\.cn|stcn\.com|cnstock\.com|chemnet\.com|mp\.weixin/.test(it.url))
    .filter(it => !seen.has(it.url));

  // Replace cninfo announcements with real news where possible
  const finalItems = [];
  // Add real news first
  for (const it of newsArticles.slice(0, 8)) {
    finalItems.push({
      title: it.title,
      url: it.url,
      snippet: it.snippet || '',
      published_at: it.published_at || now,
      fetched_at: now,
      source: it.source || 'qq.com',
    });
  }
  // Then fill with official site and cninfo
  const existing = c.news.filter(n => n.source === 'kingfa.com.cn');
  finalItems.push(...existing);
  const cninfo = c.news.filter(n => n.source === 'cninfo.com.cn');
  finalItems.push(...cninfo);

  // Dedupe by URL and trim to 10
  const seenUrls = new Set();
  const deduped = [];
  for (const n of finalItems) {
    if (seenUrls.has(n.url)) continue;
    seenUrls.add(n.url);
    deduped.push(n);
  }
  deduped.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  c.news = deduped.slice(0, 10);
  writeFileSync(fp, JSON.stringify(data, null, 2));

  console.log(`\n✓ Kingfa: ${c.news.length} items`);
  const srcCount = {};
  c.news.forEach(n => { srcCount[n.source] = (srcCount[n.source] || 0) + 1; });
  console.log(`  Source distribution:`, srcCount);
  for (const n of c.news) {
    console.log(`  [${n.published_at.slice(0,10)}] [${n.source}] ${n.title.slice(0,60)}`);
  }
}

main().catch(err => { console.error('✗', err); process.exit(1); });