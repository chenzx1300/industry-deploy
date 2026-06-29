#!/usr/bin/env node
// Aggressive topup to refill companies that fell below 10 after
// drop-sogou-undated.mjs. Bing + eefocus ONLY (no Sogou WeChat).
// Validates every URL and date.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';
import { searchEefocus } from '../src/lib/eefocus-news.mjs';

const CUTOFF = new Date('2025-06-29T00:00:00Z');
const BLOCKED = /cninfo\.com\.cn|seekingalpha|markets\.businessinsider|stockanalysis|simplywall\.st|wallstreetzen|wisesheets|tipranks|investing\.com|yahoo\.com\/news|insidermonkey|newsfilter\.io|aastocks|fool\.com|nasdaq\.com\/article|finance\.yahoo|morningstar\.com|weixin\.sogou\.com/;

async function headOk(url) { try { const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } }); return r.status >= 200 && r.status < 400; } catch { return false; } }
async function getPageDate(url) {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } });
    if (!r.ok) return null;
    const html = await r.text();
    const mp = [/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,/<meta[^>]+name=["']datePublished["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']datePublished["']/i,/<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i];
    for (const re of mp) { const m = html.match(re); if (m) { const t = new Date(m[1]); if (!isNaN(t.getTime())) return t; } }
    const tm = html.match(/<time[^>]+datetime=["']([^"']+)["']/i); if (tm) { const t = new Date(tm[1]); if (!isNaN(t.getTime())) return t; }
    const jl = html.match(/"datePublished"\s*:\s*"([^"]+)"/); if (jl) { const t = new Date(jl[1]); if (!isNaN(t.getTime())) return t; }
    return null;
  } catch { return null; }
}

const ALIASES = {
  smic: ['SMIC', '中芯国际', 'Semiconductor Manufacturing International'],
  ymtc: ['YMTC', '长江存储', 'Yangtze Memory'],
  cxmt: ['CXMT', '长鑫存储', 'Changxin Memory'],
  tsmc: ['TSMC', '台积电', 'Taiwan Semiconductor'],
  samsung: ['Samsung Electronics', '三星电子', '三星'],
  catl: ['CATL', '宁德时代'],
  nio: ['NIO', '蔚来'],
  vw: ['Volkswagen', '大众汽车', 'VW Group'],
  li: ['Li Auto', '理想汽车'],
  xpeng: ['XPeng', '小鹏汽车'],
  tesla: ['Tesla', '特斯拉'],
  toray: ['Toray', '东丽'],
  teijin: ['Teijin', '帝人', 'Teijin Group'],
  mitsubishi: ['Mitsubishi Chemical', '三菱化学'],
  solvay: ['Solvay', '苏威'],
  jushi: ['Jushi', '中国巨石', '巨石集团'],
  sinofiber: ['Sinofiber', '中复神鹰'],
  guangwei: ['Guangwei Composites', '光威复材'],
  jlhx: ['Jilin Chemical Fiber', '吉林化纤'],
  kingfa: ['Kingfa', '金发科技'],
  henkel: ['Henkel', '汉高'],
  honeywell: ['Honeywell', '霍尼韦尔'],
  bosom: ['Bosom New Materials', '本松新材', '本松'],
  feirongda: ['Feirongda', '飞荣达'],
  huitong: ['Huitong', '会通股份'],
  shenma: ['Shenma Electric', '神马电力'],
  ztt: ['ZTT', '中天科技'],
  goldwind: ['Goldwind', '金风科技'],
  dalian: ['Dalian Insulator Group', '大连电瓷'],
  sugon: ['Sugon', '曙光数创', '中科曙光'],
  avctw: ['AVC cooling', '奇鋐科技'],
  aurastw: ['Auras Technology', '双鸿科技'],
  caoe: ['China Aviation Optical', '中航光电', 'CAOE'],
  semco: ['Samsung Electro-Mechanics', '三星电机'],
  macleanfogg: ['Maclean Power Systems', 'maclean-fogg'],
  abb: ['ABB'],
  teconnectivity: ['TE Connectivity'],
  hubbell: ['Hubbell'],
  coolit: ['CoolIT Systems'],
  vertiv: ['Vertiv'],
  nvidia: ['NVIDIA'],
  mmm: ['3M', '3M Company'],
  envicool: ['Envicool', '英维克'],
  nidec: ['Nidec', '日本电产'],
  byd: ['BYD', '比亚迪'],
  toyota: ['Toyota', '丰田'],
  bmw: ['BMW'],
};

function getTokens(company) {
  const name = company.name || '';
  const tokens = name.split(/[\s,，、/]+/).filter(Boolean);
  const result = new Set();
  for (const t of tokens) {
    if (t.length >= 2) result.add(t);
    if (/[一-龥]/.test(t)) {
      for (const len of [2, 3, 4]) if (t.length >= len) result.add(t.slice(0, len));
    } else {
      result.add(t.toLowerCase());
      for (const len of [3, 4]) if (t.length >= len) result.add(t.slice(0, len).toLowerCase());
    }
  }
  for (const a of (ALIASES[company.id] || [])) {
    result.add(a);
    for (const len of [3, 4]) if (a.length >= len) result.add(a.slice(0, len));
  }
  return result;
}

function isRelevant(company, title) {
  const tokens = getTokens(company);
  const lower = title.toLowerCase();
  return [...tokens].some(t => t.length >= 2 && lower.includes(t.toLowerCase()));
}

const inds = JSON.parse(readFileSync('data/industries.json', 'utf-8'));

for (const ind of inds.industries) {
  const fp = join('data', `${ind.slug}.json`);
  if (!existsSync(fp)) continue;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;
  for (const c of data.companies) {
    const need = 10 - c.news.length;
    if (need <= 0) continue;
    console.log(`\n▸ ${ind.slug}/${c.id} (${c.name}): have ${c.news.length}, need ${need}`);
    const seen = new Set(c.news.map(n => n.url));
    const candidates = [];
    const queries = ALIASES[c.id] || [c.name, c.id];
    for (const q of queries) {
      if (candidates.length >= need * 4) break;
      const domain = (c.domain || '').replace(/^www\./, '');
      if (domain) {
        try {
          const r = await fetchBingNews(`${q} site:${domain}`, { maxResults: need * 3 });
          for (const x of r) candidates.push(x);
        } catch {}
      }
      try {
        const r = await fetchBingNews(q, { maxResults: need * 3 });
        for (const x of r) candidates.push(x);
      } catch {}
      try {
        const r = await searchEefocus(q, { maxResults: need });
        for (const x of r) candidates.push(x);
      } catch {}
    }
    const filtered = [];
    for (const r of candidates) {
      if (!r.url || seen.has(r.url)) continue;
      if (BLOCKED.test(r.url)) continue;
      const title = r.title || '';
      if (!isRelevant(c, title)) continue;
      seen.add(r.url);
      filtered.push(r);
    }
    const validated = [];
    const queue = [...filtered];
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (queue.length && validated.length < need) {
        const cand = queue.shift();
        const ok = await headOk(cand.url);
        if (!ok) continue;
        let date = null;
        if (cand.published_at) { const t = new Date(cand.published_at); if (!isNaN(t.getTime())) date = t; }
        if (!date) date = await getPageDate(cand.url);
        if (date && date < CUTOFF) continue;
        validated.push({ ...cand, _date: date });
      }
    }));
    if (validated.length > 0) {
      const now = new Date().toISOString();
      const toAdd = validated.slice(0, need).map(v => ({ title: v.title, url: v.url, snippet: '', published_at: v._date ? v._date.toISOString() : (v.published_at || null), fetched_at: now, source: v.source || (() => { try { return new URL(v.url).hostname.replace(/^www\./, ''); } catch { return ''; } })() }));
      c.news = [...c.news, ...toAdd];
      touched = true;
      console.log(`  ✓ added ${toAdd.length} (validated: ${validated.length}, passed relevance: ${filtered.length})`);
    } else {
      console.log(`  ✗ no recent (candidates: ${candidates.length}, relevant: ${filtered.length})`);
    }
  }
  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}
console.log('\n=== Done ===');
