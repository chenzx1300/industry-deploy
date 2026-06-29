#!/usr/bin/env node
// Topup for non-A-share companies using Bing News search + cninfo for
// HK-listed (Li Auto, NIO, XPeng, SMIC, BYD, CATL — wait, those are covered).
// Filters results: must be ≥ cutoff, must contain company keywords.
//
// Usage: node scripts/topup-intl.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);
const CUTOFF = new Date('2025-06-30T00:00:00Z');

// Company -> {aliases, blockedDomains, stock}
const COMPANIES = {
  // NEV
  li:    { aliases: ['Li Auto', '理想汽车', '理想', 'LI', 'Li Auto Inc'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  vw:    { aliases: ['Volkswagen', '大众汽车', 'VW Group', 'Volkswagen AG'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  nio:   { aliases: ['NIO', '蔚来', 'NIO Inc'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  xpeng: { aliases: ['XPeng', '小鹏汽车', 'XPENG'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  toyota:{ aliases: ['Toyota', '丰田'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  // Semiconductor
  cxmt:  { aliases: ['CXMT', '长鑫存储', 'Changxin Memory'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  ymtc:  { aliases: ['YMTC', '长江存储', 'Yangtze Memory'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  tsmc:  { aliases: ['TSMC', '台积电', 'Taiwan Semiconductor'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  samsung:{aliases: ['Samsung Electronics', '三星电子', 'Samsung'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  nvidia:{aliases: ['NVIDIA', '英伟达'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  intel: {aliases: ['Intel', '英特尔'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  // Carbon fiber
  toray: {aliases: ['Toray', '东丽', 'Toray Industries'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  teijin:{aliases: ['Teijin', '帝人'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  mitsubishi:{aliases: ['Mitsubishi Chemical', '三菱化学'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  solvay:{aliases: ['Solvay', '苏威'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  jushi: {aliases: ['Jushi', '中国巨石', '巨石集团'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  // Thermal materials
  mmm:   {aliases: ['3M', '3M Company'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  honeywell:{aliases: ['Honeywell', '霍尼韦尔'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  henkel:{aliases: ['Henkel', '汉高'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  // Composite insulator
  macleanfogg:{aliases: ['Maclean Power Systems', 'maclean-fogg', 'MacLean-Fogg'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  abb:   {aliases: ['ABB'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  hubbell:{aliases: ['Hubbell'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  teconnectivity:{aliases: ['TE Connectivity'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  // Datacenter cooling
  avctw: {aliases: ['AVC', '奇鋐科技', 'AVC Corporation'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  aurastw:{aliases: ['Auras', '双鸿科技', 'Auras Technology'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  coolit:{aliases: ['CoolIT Systems'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  vertiv:{aliases: ['Vertiv'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  nidec: {aliases: ['Nidec', '日本电产'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
  semco: {aliases: ['Samsung Electro-Mechanics', '三星电机'], blocked: ['weixin.sogou.com', 'cninfo.com.cn'] },
};

const STOPWORDS_CN = new Set('的 是 在 和 与 为 于 有 也 被 这 那 但 而 或 至 以 及 等 就 要 会 能 可 其 之 上下 中 外 我们 你 他 她 它 已 来 去 看 说 让 给 到 从 把 用 像 跟 跟 被 让 给'.split(/\s+/));
const STOPWORDS_EN = new Set(['the','a','an','in','on','at','to','for','of','with','by','is','are','was','were','be','been','and','or','but','from','as','its','it','this','that','have','has','had','will','would','can','could','may','might','not','no','do','does','did','get','got','just','one','two','three','new','first','last','over','under','more','most','some','all','says','said','say','now','then','after','before','how','why','what','when','who','where','which','than','about','into','through','during','up','down','out','off','also','only','very','much','many','few','our','your','his','her','their','its','my']);

function isRelevant(title, aliases) {
  const lower = title.toLowerCase();
  for (const a of aliases) {
    if (lower.includes(a.toLowerCase())) return true;
    // CN: take first 2 chars
    if (/[一-龥]/.test(a) && lower.includes(a.slice(0, 2))) return true;
  }
  return false;
}

async function getPageDate(url) {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } });
    if (!r.ok) return null;
    const html = await r.text();
    const mp = [/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,/<meta[^>]+name=["']datePublished["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']datePublished["']/i,/<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i];
    for (const re of mp) { const m = html.match(re); if (m) { const t = new Date(m[1]); if (!isNaN(t.getTime())) return t; } }
    const tm = html.match(/<time[^>]+datetime=["']([^"']+)["']/i); if (tm) { const t = new Date(tm[1]); if (!isNaN(t.getTime())) return t; }
    const jl = html.match(/"datePublished"\s*:\s*"([^"]+)"/); if (jl) { const t = new Date(jl[1]); if (!isNaN(t.getTime())) return t; }
    return null;
  } catch { return null; }
}

async function headOk(url) {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } });
    return r.status >= 200 && r.status < 400;
  } catch { return false; }
}

async function fetchForCompany(c) {
  const cfg = COMPANIES[c.id];
  if (!cfg) return [];
  const candidates = [];
  for (const q of cfg.aliases) {
    if (candidates.length >= 40) break;
    try {
      const r = await fetchBingNews(q, { maxResults: 15 });
      for (const x of r) candidates.push(x);
    } catch {}
  }
  // Filter: relevant + not blocked
  const seen = new Set();
  const filtered = [];
  for (const r of candidates) {
    if (!r.url || seen.has(r.url)) continue;
    if (cfg.blocked.some(b => r.url.includes(b))) continue;
    if (!isRelevant(r.title || '', cfg.aliases)) continue;
    seen.add(r.url);
    filtered.push(r);
  }
  return filtered;
}

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));

for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  if (!existsSync(fp)) continue;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;

  for (const c of data.companies) {
    if (c.news.length >= TARGET) continue;
    if (!COMPANIES[c.id]) continue;
    const need = TARGET - c.news.length;
    console.log(`\n▸ ${ind.slug}/${c.id} (${c.name}): have ${c.news.length}, need ${need}`);

    const candidates = await fetchForCompany(c);
    console.log(`  candidates: ${candidates.length}`);
    if (candidates.length === 0) continue;

    const seen = new Set(c.news.map(n => n.url));
    const now = new Date().toISOString();
    let added = 0;

    // Process candidates in parallel, with concurrency 6
    const queue = [...candidates];
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length && c.news.length < TARGET) {
        const cand = queue.shift();
        if (!cand.url || seen.has(cand.url)) continue;
        const ok = await headOk(cand.url);
        if (!ok) continue;
        let date = null;
        if (cand.published_at) { const t = new Date(cand.published_at); if (!isNaN(t.getTime())) date = t; }
        if (!date) date = await getPageDate(cand.url);
        if (date && date < CUTOFF) continue;
        if (!date) continue; // strict: must have date
        seen.add(cand.url);
        c.news.push({
          title: cand.title,
          url: cand.url,
          snippet: '',
          published_at: date.toISOString(),
          fetched_at: now,
          source: (() => { try { return new URL(cand.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
        });
        added++;
      }
    }));
    console.log(`  ✓ added ${added} (now ${c.news.length}/${TARGET})`);
    touched = true;
  }

  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2));
}

console.log('\n=== Done ===');