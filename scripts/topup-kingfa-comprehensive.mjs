#!/usr/bin/env node
// Comprehensive Kingfa topup:
//  1. Get 3 real news from official site (kingfa.com.cn)
//  2. Get up to 7 cninfo announcements spanning the last year (not just last month)
//  3. Generate informative snippets via LLM (not just echo of title)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CUTOFF = new Date('2025-06-29T00:00:00Z');
const TARGET = 10;

const BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic';
const MODEL = process.env.ANTHROPIC_MODEL || 'MiniMax-M3';

function getApiKey() {
  if (process.env.ANTHROPIC_AUTH_TOKEN) return process.env.ANTHROPIC_AUTH_TOKEN;
  const p = `${homedir()}/.claude/settings.json`;
  if (!existsSync(p)) return null;
  try {
    const s = JSON.parse(readFileSync(p, 'utf-8'));
    return s?.env?.ANTHROPIC_AUTH_TOKEN || null;
  } catch { return null; }
}

async function fetchOfficialSite() {
  const listId = 11;
  const url = `https://www.kingfa.com.cn/portal/list/index/id/${listId}.html`;
  const items = [];
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return items;
    const html = await r.text();
    const blockRe = /<a[^>]+href="\/portal\/article\/index\/id\/(\d+)\/cid\/(\d+)\.html"[^>]*>\s*<img[^>]+src="[^"]*\/kfdoc\/portal\/(\d{8})\/[^"]*"[^>]*\/?>(?:[^<]|<(?!\/a>))*?<div class="text">([^<]+)<\/div>/g;
    let m;
    while ((m = blockRe.exec(html)) !== null) {
      const [, id, cid, yyyymmdd, title] = m;
      const y = yyyymmdd.slice(0, 4), mo = yyyymmdd.slice(4, 6), d = yyyymmdd.slice(6, 8);
      const date = new Date(`${y}-${mo}-${d}T00:00:00Z`);
      if (isNaN(date.getTime()) || date < CUTOFF) continue;
      items.push({ id, cid, date, title: title.trim() });
    }
  } catch {}
  return items;
}

async function fetchArticleSnippet(id, cid) {
  try {
    const r = await fetch(`https://www.kingfa.com.cn/portal/article/index/id/${id}/cid/${cid}.html`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return '';
    const html = await r.text();
    const md = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if (md && md[1].trim()) return md[1].trim().slice(0, 250);
    const main = html.match(/<div[^>]+class=["'][^"']*detail[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (main) {
      const ps = main[1].match(/<p[^>]*>([\s\S]*?)<\/p>/g) || [];
      for (const p of ps) {
        const text = p.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
        if (text.length > 30) return text.slice(0, 250);
      }
    }
    return '';
  } catch { return ''; }
}

async function lookupOrgId(code) {
  const r = await fetch('https://www.cninfo.com.cn/new/information/topSearch/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: `keyWord=${code}&maxNum=10`,
  });
  const arr = await r.json();
  if (Array.isArray(arr) && arr.length > 0) return { orgId: arr[0].orgId, zwjc: arr[0].zwjc };
  return null;
}

async function fetchCninfoAnnouncements(code, orgId) {
  // Get all announcements across a year
  const seDate = `2025-06-01~${new Date().toISOString().slice(0,10)}`;
  const body = `pageNum=1&pageSize=200&column=sse&tabName=fulltext&plate=&stock=${code}%2C${orgId}&searchkey=&secid=&category=&trade=&seDate=${seDate}&sortName=&sortType=&isHLtitle=true`;
  const r = await fetch('https://www.cninfo.com.cn/new/hisAnnouncement/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': UA,
      'Accept': '*/*',
      'Origin': 'https://www.cninfo.com.cn',
      'Referer': 'https://www.cninfo.com.cn/',
    },
    body,
  });
  const j = await r.json();
  return j.announcements || [];
}

async function generateSnippet(title) {
  // Use LLM to generate informative snippet for an announcement title
  const KEY = getApiKey();
  if (!KEY) return '';
  try {
    const sys = `你是一个A股票公司公告摘要专家。为给定的公告标题生成40-80字的中文摘要，说明公告的核心内容、用词简洁明了。

Examples:
Input: 金发科技2025年年度权益分派实施公告
Output: 公司发布2025年年度权益分派方案，明确每10股派发现金红利X元，股权登记日为X日，除权除息日为X日。

Input: 金发科技关于2026年5月为控股子公司提供担保的进展公告
Output: 披露2026年5月期间为控股子公司提供担保的最新进展，包括担保金额、被担保方及担保期限等明细。

Input: 金发科技2026年员工持股计划持有人第一次会议决议公告
Output: 公司召开2026年员工持股计划首次持有人会议，审议通过管理委员会选举、份额确认等议案。

Output ONLY the snippet, no preamble.`;

    const res = await fetch(`${BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: sys,
        messages: [{ role: 'user', content: title }],
      }),
    });
    if (!res.ok) return '';
    const j = await res.json();
    return (j.content?.[0]?.text || '').trim().slice(0, 250);
  } catch { return ''; }
}

async function main() {
  const SLUG = 'thermal-materials-industry';
  const fp = join('data', `${SLUG}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const c = data.companies.find(x => x.id === 'kingfa');
  if (!c) { console.error('kingfa not found'); process.exit(1); }

  console.log(`▸ ${c.name}: current ${c.news.length} items, refilling to ${TARGET}...`);

  // 1. Get real news from official site
  console.log('  Fetching official site...');
  const officialItems = await fetchOfficialSite();
  console.log(`  Official site: ${officialItems.length} articles`);
  // Get snippets
  for (const it of officialItems) {
    it.snippet = await fetchArticleSnippet(it.id, it.cid);
  }
  const seen = new Set();

  // 2. Get cninfo announcements spanning the year
  console.log('  Fetching cninfo announcements (last year)...');
  const info = await lookupOrgId('600143');
  if (!info) { console.error('no orgId for 600143'); return; }
  console.log(`  orgId=${info.orgId} (${info.zwjc})`);
  const anns = await fetchCninfoAnnouncements('600143', info.orgId);
  console.log(`  cninfo: ${anns.length} total announcements`);

  // 3. Categorize — pick variety of announcement types, spread across the year
  const annsByDate = anns.slice().sort((a, b) => new Date(b.announcementTime) - new Date(a.announcementTime));

  // 4. Build final 10: 3 from official site + 7 from cninfo spread across year
  const finalItems = [];
  const now = new Date().toISOString();

  // Take official site items (sorted by date desc)
  officialItems.sort((a, b) => b.date - a.date);
  for (const it of officialItems.slice(0, 3)) {
    finalItems.push({
      title: it.title,
      url: `https://www.kingfa.com.cn/portal/article/index/id/${it.id}/cid/${it.cid}.html`,
      snippet: it.snippet,
      published_at: it.date.toISOString(),
      fetched_at: now,
      source: 'kingfa.com.cn',
    });
    seen.add(it.title);
  }
  console.log(`  Added ${finalItems.length} official site items`);

  // Fill rest from cninfo — diversify by date and type
  const slotsLeft = TARGET - finalItems.length;
  const needed = Math.min(slotsLeft, annsByDate.length);

  // To get date spread: take some recent + some older
  // recent: first 3 from cninfo
  const recentAnns = annsByDate.slice(0, Math.ceil(needed * 0.6));
  // older: evenly distributed across the rest of the year
  const olderAnns = [];
  const restAnns = annsByDate.slice(recentAnns.length);
  const step = Math.max(1, Math.floor(restAnns.length / (needed - recentAnns.length + 1)));
  for (let i = 0; olderAnns.length < needed - recentAnns.length && i < restAnns.length; i += step) {
    olderAnns.push(restAnns[i]);
  }

  const pickedAnns = [...recentAnns, ...olderAnns].slice(0, needed);
  console.log(`  Picking ${pickedAnns.length} cninfo announcements (${recentAnns.length} recent + ${olderAnns.length} older)`);

  // Generate snippets in parallel
  const annSnippets = await Promise.all(pickedAnns.map(a => generateSnippet(a.announcementTitle)));
  for (let i = 0; i < pickedAnns.length; i++) {
    const a = pickedAnns[i];
    finalItems.push({
      title: a.announcementTitle.replace(/^金发科技:金发科技/, '金发科技').replace(/^金发科技:/, ''),
      url: `http://static.cninfo.com.cn/${a.adjunctUrl}`,
      snippet: annSnippets[i] || '',
      published_at: new Date(a.announcementTime).toISOString(),
      fetched_at: now,
      source: 'cninfo.com.cn',
    });
  }

  // Sort by date DESC and trim to TARGET
  finalItems.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  c.news = finalItems.slice(0, TARGET);
  writeFileSync(fp, JSON.stringify(data, null, 2));

  console.log(`\n✓ Kingfa: ${c.news.length} items`);
  for (const n of c.news) {
    console.log(`  [${n.published_at.slice(0,10)}] [${n.source.padEnd(15)}] ${n.title.slice(0,55)}`);
    console.log(`    ${n.snippet.slice(0,80)}`);
  }

  const dates = c.news.map(n => new Date(n.published_at)).sort((a, b) => a - b);
  console.log(`\n  Date range: ${dates[0].toISOString().slice(0,10)} → ${dates[dates.length-1].toISOString().slice(0,10)}`);
}

main().catch(err => { console.error('✗', err); process.exit(1); });