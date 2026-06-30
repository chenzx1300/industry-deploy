#!/usr/bin/env node
// Better Bing search scraper for Kingfa news — fixes title parsing and fetches more.

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
    if (!r.ok) return '';
    return await r.text();
  } catch { return ''; }
}

// Bing search results: structure is
// <li class="b_algo">
//   <h2><a href="URL">TITLE</a></h2>
//   ...breadcrumb (caption)...
//   <p>SNIPPET</p>
// </li>
function parseBing(html) {
  const items = [];
  // Match each <li class="b_algo">...</li>
  const algoRe = /<li class="b_algo"[^>]*>([\s\S]*?)(?=<li class="b_algo"|<\/ol>|$)/g;
  let m;
  while ((m = algoRe.exec(html)) !== null) {
    const block = m[1];
    // Extract URL from h2 > a
    const linkMatch = block.match(/<h2[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;
    const url = linkMatch[1];
    let title = linkMatch[2].replace(/<[^>]+>/g, '').replace(/<!--[^>]+-->/g, '').trim();
    // Skip if title is too short or contains junk
    if (title.length < 10) continue;
    // Extract snippet from first <p>
    const paraMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const snippet = paraMatch ? paraMatch[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim() : '';
    // Skip non-news / corporate pages
    if (/kingfa\.com\.cn\/?$|kingfa\.com\.cn\/aboutus|kingfa\.com\.cn\/general|kingfa\.com\.cn\/subsite|kingfa\.com\/$|kingfa\.com\/en|baike\.baidu|aiqicha|qcc\.com|gov\.cn|dingtalk|weibo|linkedin|qq\.com\/passport/.test(url)) continue;
    items.push({ url, title, snippet });
  }
  return items;
}

async function fetchArticleMeta(url) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://cn.bing.com/',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { title: '', snippet: '', date: null };
    const html = await r.text();
    // Title from <title> tag
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    let title = titleMatch ? titleMatch[1].trim() : '';
    // Strip common suffixes
    title = title.replace(/_腾讯新闻$|_新浪财经$|_新浪网$|_网易$/, '').replace(/-腾讯新闻$/, '');
    // Snippet from meta description
    const md = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const snippet = md ? md[1].trim().slice(0, 250) : '';
    // Date from URL or meta
    let date = null;
    const urlDate = url.match(/\/(\d{4})(\d{2})(\d{2})/);
    if (urlDate) date = `${urlDate[1]}-${urlDate[2]}-${urlDate[3]}`;
    if (!date) {
      const articleTime = html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i);
      if (articleTime) {
        const d = new Date(articleTime[1]);
        if (!isNaN(d.getTime())) date = d.toISOString().slice(0, 10);
      }
    }
    return { title, snippet, date };
  } catch { return { title: '', snippet: '', date: null }; }
}

async function main() {
  const SLUG = 'thermal-materials-industry';
  const fp = join('data', `${SLUG}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const c = data.companies.find(x => x.id === 'kingfa');
  if (!c) { console.error('kingfa not found'); process.exit(1); }
  console.log(`▸ ${c.name}: current ${c.news.length} items`);

  const allArticles = new Map();
  const queries = [
    '金发科技 site:news.qq.com',
    '金发科技 site:finance.sina.com.cn',
    '金发科技 site:stcn.com',
    '金发科技 site:cnstock.com',
    '金发科技 site:nbd.com.cn',
    '金发科技 site:cls.cn',
    '金发科技 site:yicai.com',
    '金发科技 site:huxiu.com',
    '金发科技 site:36kr.com',
    '金发科技 site:gasgoo.com',
    '金发科技 site:chemnet.com',
  ];
  for (const q of queries) {
    console.log(`  Bing: ${q}`);
    const html = await bingSearch(q);
    if (!html) { console.log('    → empty'); continue; }
    const items = parseBing(html);
    console.log(`    → ${items.length} results`);
    for (const it of items) {
      if (!allArticles.has(it.url)) allArticles.set(it.url, it);
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`  Total unique: ${allArticles.size}`);

  // Filter to actual news (not corporate pages)
  const kingfaArticles = [...allArticles.values()].filter(it => {
    const t = (it.title || '') + ' ' + (it.snippet || '');
    return /金发|kingfa|600143/.test(t);
  });
  console.log(`  About Kingfa: ${kingfaArticles.length}`);

  // Fetch proper title + date + snippet for each
  console.log('\nFetching metadata for each article...');
  const enriched = [];
  for (const it of kingfaArticles.slice(0, 15)) {
    const meta = await fetchArticleMeta(it.url);
    if (!meta.title || meta.title.length < 5) continue;
    enriched.push({
      url: it.url,
      title: meta.title,
      snippet: meta.snippet || it.snippet,
      published_at: meta.date,
    });
    console.log(`    [${meta.date || '??'}] ${meta.title.slice(0, 60)}`);
  }

  // Filter to recent
  const recent = enriched.filter(it => it.published_at && new Date(it.published_at) >= CUTOFF);
  console.log(`\n  Recent (>= ${CUTOFF.toISOString().slice(0,10)}): ${recent.length}`);

  // Add to data
  const seen = new Set(c.news.map(n => n.url));
  const now = new Date().toISOString();
  const additions = recent
    .filter(it => !seen.has(it.url))
    .map(it => ({
      title: it.title,
      url: it.url,
      snippet: it.snippet,
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
    console.log(`  [${n.published_at.slice(0,10)}] [${n.source.padEnd(18)}] ${n.title.slice(0,55)}`);
  }
}

main().catch(err => { console.error('✗', err); process.exit(1); });