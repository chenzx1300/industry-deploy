#!/usr/bin/env node
// Topup for companies that fell below 10 after filter-recent.mjs. Fetches
// fresh news from Bing + Sogou and validates every candidate's publish
// date (via page fetch) before accepting.
//
// Usage: node scripts/topup-recent.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';
import { searchSogouWeChat } from '../src/lib/sogou-news.mjs';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);
const CUTOFF = new Date('2025-06-29T00:00:00Z');

const BLOCKED = /cninfo\.com\.cn|seekingalpha|markets\.businessinsider|stockanalysis|simplywall\.st|wallstreetzen|wisesheets|tipranks|investing\.com|yahoo\.com\/news|insidermonkey|newsfilter\.io|aastocks|fool\.com|nasdaq\.com\/article|finance\.yahoo|morningstar\.com/;

async function headOk(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
    });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

async function getPageDate(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const metaPatterns = [
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
      /<meta[^>]+name=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']datePublished["']/i,
      /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:article:published_time["'][^>]+content=["']([^"']+)["']/i,
    ];
    for (const re of metaPatterns) {
      const m = html.match(re);
      if (m) {
        const t = new Date(m[1]);
        if (!isNaN(t.getTime())) return t;
      }
    }
    const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if (timeMatch) {
      const t = new Date(timeMatch[1]);
      if (!isNaN(t.getTime())) return t;
    }
    const jsonLd = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (jsonLd) {
      const t = new Date(jsonLd[1]);
      if (!isNaN(t.getTime())) return t;
    }
    return null;
  } catch {
    return null;
  }
}

const ALIASES = {
  smic: ['SMIC', '中芯国际', 'Semiconductor Manufacturing International'],
  cxmt: ['CXMT', '长鑫存储', 'Changxin Memory'],
  tsmc: ['TSMC', '台积电', 'Taiwan Semiconductor'],
  samsung: ['Samsung Electronics', '三星电子'],
  nvidia: ['NVIDIA'],
  vw: ['Volkswagen', '大众汽车'],
  toyota: ['Toyota', '丰田'],
  xpeng: ['XPeng', '小鹏汽车'],
  li: ['Li Auto', '理想汽车'],
  catl: ['CATL', '宁德时代'],
  nio: ['NIO', '蔚来'],
  byd: ['BYD', '比亚迪'],
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
  mmm: ['3M', '3M Company'],
  honeywell: ['Honeywell', '霍尼韦尔'],
  bosom: ['Bosom New Materials', '本松新材', '本松'],
  feirongda: ['Feirongda', '飞荣达'],
  huitong: ['Huitong', '会通股份'],
  abb: ['ABB', 'ABB Group'],
  shenma: ['Shenma Electric', '神马电力'],
  ztt: ['ZTT', '中天科技'],
  teconnectivity: ['TE Connectivity'],
  hubbell: ['Hubbell', 'Hubbell Incorporated'],
  macleanfogg: ['Maclean Power Systems', 'Maclean-Fogg'],
  goldwind: ['Goldwind', '金风科技'],
  dalian: ['Dalian Insulator Group', '大连电瓷'],
  sugon: ['Sugon', '曙光数创', '中科曙光'],
  avctw: ['AVC cooling', '奇鋐科技'],
  aurastw: ['Auras Technology', '双鸿科技'],
  caoe: ['China Aviation Optical', '中航光电', 'CAOE'],
  semco: ['Samsung Electro-Mechanics', '三星电机'],
  nidec: ['Nidec', '日本电产'],
  envicool: ['Envicool', '英维克'],
  coolit: ['CoolIT Systems'],
  vertiv: ['Vertiv'],
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

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));

for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  if (!existsSync(fp)) continue;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;

  for (const c of data.companies) {
    const need = TARGET - c.news.length;
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
      if (/[一-龥]/.test(q)) {
        try {
          const r = await searchSogouWeChat(q, { maxResults: need * 2 });
          for (const x of r) {
            if (x.sogouUrl) candidates.push({ title: x.title, url: x.sogouUrl, source: 'weixin.sogou.com' });
          }
        } catch {}
      }
    }

    // Filter: relevance + blocked + dedup
    const filtered = [];
    for (const r of candidates) {
      if (!r.url || seen.has(r.url)) continue;
      if (BLOCKED.test(r.url)) continue;
      const title = r.title || '';
      if (!isRelevant(c, title)) continue;
      seen.add(r.url);
      filtered.push(r);
    }

    // Validate: HEAD + check date
    const validated = [];
    const queue = [...filtered];
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (queue.length && validated.length < need) {
        const cand = queue.shift();
        const ok = await headOk(cand.url);
        if (!ok) continue;
        // Try to get date from Bing result first, then from page
        let date = null;
        if (cand.published_at) {
          const t = new Date(cand.published_at);
          if (!isNaN(t.getTime())) date = t;
        }
        if (!date) date = await getPageDate(cand.url);
        if (date && date < CUTOFF) {
          // too old
          continue;
        }
        validated.push({ ...cand, _date: date });
      }
    }));

    if (validated.length > 0) {
      const now = new Date().toISOString();
      const toAdd = validated.slice(0, need).map(v => ({
        title: v.title,
        url: v.url,
        snippet: '',
        published_at: v._date ? v._date.toISOString() : (v.published_at || null),
        fetched_at: now,
        source: v.source || (() => { try { return new URL(v.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
      }));
      c.news = [...c.news, ...toAdd];
      touched = true;
      console.log(`  ✓ added ${toAdd.length} (of ${validated.length} validated, ${filtered.length} passed relevance)`);
    } else {
      console.log(`  ✗ no recent results (candidates: ${candidates.length}, passed relevance: ${filtered.length})`);
    }
  }

  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

console.log('\n=== Done ===');
