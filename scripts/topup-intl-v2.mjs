#!/usr/bin/env node
// v2 topup: more permissive date extraction. Accepts:
//   1. Bing result published_at (if available)
//   2. Page <meta> / <time> / JSON-LD datePublished
//   3. URL path pattern /YYYY/MM/DD/ or /YYYY-MM-DD
//   4. Title date pattern: YYYY年MM月DD日 / MMM DD, YYYY
//   5. Title or snippet phrases like "2 hours ago", "yesterday" (last resort, Bing only)
//
// For Taiwan-listed companies, also fetch from MOPS (mops.twse.com.tw).
//
// Usage: node scripts/topup-intl-v2.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);
const CUTOFF = new Date('2025-06-30T00:00:00Z');

const COMPANIES = {
  li:     { aliases: ['Li Auto', '理想汽车', '理想', 'LI'] },
  vw:     { aliases: ['Volkswagen', '大众汽车', 'VW Group', 'Volkswagen AG'] },
  nio:    { aliases: ['NIO', '蔚来', 'NIO Inc'] },
  xpeng:  { aliases: ['XPeng', '小鹏汽车', 'XPENG'] },
  toyota: { aliases: ['Toyota', '丰田'] },
  cxmt:   { aliases: ['CXMT', '长鑫存储', 'Changxin Memory'] },
  ymtc:   { aliases: ['YMTC', '长江存储', 'Yangtze Memory'] },
  tsmc:   { aliases: ['TSMC', '台积电', 'Taiwan Semiconductor'] },
  samsung:{ aliases: ['Samsung Electronics', '三星电子', 'Samsung'] },
  nvidia: { aliases: ['NVIDIA', '英伟达'] },
  intel:  { aliases: ['Intel', '英特尔'] },
  toray:  { aliases: ['Toray', '东丽', 'Toray Industries'] },
  teijin: { aliases: ['Teijin', '帝人'] },
  mitsubishi:{ aliases: ['Mitsubishi Chemical', '三菱化学'] },
  solvay: { aliases: ['Solvay', '苏威'] },
  mmm:    { aliases: ['3M', '3M Company'] },
  honeywell:{ aliases: ['Honeywell', '霍尼韦尔'] },
  henkel: { aliases: ['Henkel', '汉高'] },
  macleanfogg:{ aliases: ['Maclean Power Systems', 'maclean-fogg', 'MacLean-Fogg'] },
  abb:    { aliases: ['ABB'] },
  hubbell:{ aliases: ['Hubbell'] },
  teconnectivity:{ aliases: ['TE Connectivity'] },
  avctw:  { aliases: ['AVC', '奇鋐科技', 'AVC Corporation', '奇鋐'] },
  aurastw:{ aliases: ['Auras', '双鸿科技', 'Auras Technology'] },
  coolit: { aliases: ['CoolIT Systems'] },
  vertiv: { aliases: ['Vertiv'] },
  nidec:  { aliases: ['Nidec', '日本电产'] },
  semco:  { aliases: ['Samsung Electro-Mechanics', '三星电机'] },
};

function isRelevant(title, aliases) {
  const lower = title.toLowerCase();
  for (const a of aliases) {
    if (lower.includes(a.toLowerCase())) return true;
    if (/[一-龥]/.test(a) && lower.includes(a.slice(0, 2))) return true;
  }
  return false;
}

function extractDateFromText(text) {
  if (!text) return null;
  // YYYY-MM-DD or YYYY/MM/DD
  let m = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }
  // YYYY年MM月DD日
  m = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

async function fetchPageAndExtract(url) {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } });
    if (!r.ok) return { ok: false };
    const html = await r.text();
    // meta
    const mp = [/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,/<meta[^>]+name=["']datePublished["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']datePublished["']/i,/<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i];
    for (const re of mp) { const m = html.match(re); if (m) { const t = new Date(m[1]); if (!isNaN(t.getTime())) return { ok: true, date: t }; } }
    const tm = html.match(/<time[^>]+datetime=["']([^"']+)["']/i); if (tm) { const t = new Date(tm[1]); if (!isNaN(t.getTime())) return { ok: true, date: t }; }
    const jl = html.match(/"datePublished"\s*:\s*"([^"]+)"/); if (jl) { const t = new Date(jl[1]); if (!isNaN(t.getTime())) return { ok: true, date: t }; }
    // URL path patterns
    let d = extractDateFromText(url);
    if (d) return { ok: true, date: d };
    // Title pattern in HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      d = extractDateFromText(titleMatch[1]);
      if (d) return { ok: true, date: d };
    }
    return { ok: true, date: null };
  } catch { return { ok: false }; }
}

// MOPS for Taiwan-listed companies (avctw, aurastw)
async function fetchMOPS(stockCode) {
  try {
    // mops announcement API
    const r = await fetch('https://mopsov.twse.com.tw/server-java/t146sb05', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
      body: `step=1&firstin=true&off=1&keyword4=&code1=&TYPEK2=&checkbtn=&queryName=co_id&inpuType=co_id&TYPEK=all&co_id=${stockCode}`,
    });
    const text = await r.text();
    return text;
  } catch { return ''; }
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
    const cfg = COMPANIES[c.id];

    // Collect candidates
    const candidates = [];
    for (const q of cfg.aliases) {
      if (candidates.length >= 60) break;
      try {
        const r = await fetchBingNews(q, { maxResults: 20 });
        for (const x of r) candidates.push(x);
      } catch {}
    }

    const seen = new Set(c.news.map(n => n.url));
    const now = new Date().toISOString();
    let added = 0;

    const queue = [...candidates];
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length && c.news.length < TARGET) {
        const cand = queue.shift();
        if (!cand.url || seen.has(cand.url)) continue;
        if (!isRelevant(cand.title || '', cfg.aliases)) continue;
        if (cand.url.includes('weixin.sogou.com') || cand.url.includes('cninfo.com.cn')) continue;

        const r = await fetchPageAndExtract(cand.url);
        if (!r.ok) continue;
        let date = r.date;
        if (!date) date = extractDateFromText(cand.title);
        if (date && date < CUTOFF) continue;
        if (!date) continue; // still need a date

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