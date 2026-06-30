#!/usr/bin/env node
// Verify all news URLs across 46 companies.
// - Parallel HEAD checks with 6s timeout per request
// - Skip broad-domain sources (cninfo, sec.gov) on content check
// - Output broken items per company

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const TIMEOUT_MS = 6000;
const PARALLEL = 10;
const SLUGS = JSON.parse(readFileSync('data/industries.json', 'utf-8')).industries.map(i => i.slug);

const KEYWORDS = {
  'bosom': ['本松', 'Bosom'],
  'kingfa': ['金发', 'kingfa', 'Kingfa'],
  'henkel': ['汉高', 'Henkel'],
  'mmm': ['3M'],
  'byd': ['比亚迪', 'BYD'],
  'catl': ['宁德时代', 'CATL'],
  'li': ['理想', 'Li Auto'],
  'xpeng': ['小鹏', 'XPENG'],
  'nio': ['蔚来', 'NIO'],
  'tesla': ['特斯拉', 'Tesla'],
  'rivian': ['Rivian'],
  'toyota': ['丰田', 'Toyota'],
  'vw': ['大众', 'Volkswagen'],
  'abb': ['ABB'],
  'teconnectivity': ['TE Connectivity'],
  'hubbell': ['Hubbell'],
  'macleanfogg': ['MacLean'],
  'envicool': ['英维克', 'Envicool'],
  'avctw': ['奇鋐', 'AVC'],
  'aurastw': ['双鸿', 'Auras', '雙鴻'],
  'nidec': ['Nidec', '尼得科'],
  'semco': ['三星电机', 'SEMCO'],
  'vertiv': ['Vertiv', '维谛'],
  'coolit': ['CoolIT'],
  'nvidia': ['NVIDIA', '英伟达'],
  'intel': ['Intel'],
  'tsmc': ['台积电', 'TSMC'],
  'samsung': ['三星', 'Samsung'],
  'cxmt': ['长鑫', 'CXMT'],
  'ymtc': ['长江存储', 'YMTC'],
  'toray': ['东丽', 'Toray'],
  'teijin': ['帝人', 'Teijin'],
  'mitsubishi': ['三菱', 'Mitsubishi'],
  'solvay': ['索尔维', 'Solvay'],
  'jushi': ['巨石', 'Jushi'],
  'feirongda': ['飞荣达', 'FRD'],
};

const BROAD = ['cninfo.com.cn', 'static.cninfo', 'sec.gov', 'hkexnews.hk', 'mops.twse', 'frd.cn', 'bosomchina.com'];

async function fetchHead(url) {
  try {
    const r = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    });
    return { status: r.status, ok: r.ok };
  } catch (e) {
    return { status: 0, ok: false, error: e.message?.slice(0, 50) || 'timeout' };
  }
}

async function fetchGet(url) {
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate', 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!r.ok) return { status: r.status, ok: false, body: '' };
    const body = await r.text();
    return { status: r.status, ok: true, body };
  } catch (e) {
    return { status: 0, ok: false, body: '', error: e.message?.slice(0, 50) || 'timeout' };
  }
}

// JS-rendered corporate sites — short body doesn't mean broken
const JS_CORP_SITES = [
  'solvay.com', 'vertiv.com', 'te.com', 'hubbell.gcs-web.com',
  'samsungsem.com', 'mitsuichemicals.com', 'mpi-thermal.com',
  'frd.cn', 'bosomchina.com', 'kingfa.com.cn',
  'macleanpower.com', 'maclean-fogg.com', 'mmm.com', 'henkel.com',
  'teijin.com', 'toray.com', 'mcgc.com', 'jushi.com', 'symington.com',
  'auras.com.tw', 'avc.co', 'mouser.com', 'digikey.com',
  'news.qq.com', 'cnevpost.com', 'stocktitan.net',
];

// Known authoritative domains — trust short body too
const TRUSTED_DOMAINS = [
  'sec.gov', 'hkexnews.hk', 'mops.twse.com.tw', 'cninfo.com.cn',
  'frd.cn', 'bosomchina.com',
];

async function checkItem(coId, item) {
  const url = item.url;
  let res = await fetchHead(url);
  if (!res.ok) {
    res = await fetchGet(url);
  }
  // Hard fail: timeout, refused, 4xx, 5xx
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}${res.error ? ' (' + res.error + ')' : ''}` };

  // PDFs: trust them if URL is .pdf and status 200
  if (url.toLowerCase().endsWith('.pdf') && res.status === 200) {
    return { ok: true, status: res.status, note: 'PDF' };
  }

  const isBroad = BROAD.some(d => url.includes(d));
  if (isBroad) return { ok: true, status: res.status };

  // JS-rendered corp sites: accept short body, trust URL
  const isJSCorp = JS_CORP_SITES.some(d => url.includes(d));
  const body = res.body || '';
  if (isJSCorp) {
    return { ok: true, status: res.status, note: 'JS-rendered' };
  }

  const expected = KEYWORDS[coId];
  if (!expected) return { ok: true, status: res.status };

  // Body too short (<500 chars) and not JS corp → likely JS or paywall; flag for review
  if (body.length < 500) {
    return { ok: false, reason: `body too short (${body.length} chars, likely JS)` };
  }
  const matched = expected.some(kw => body.includes(kw));
  if (!matched) {
    return { ok: false, reason: `content mismatch (no ${expected.slice(0,2).join('/')})` };
  }
  return { ok: true, status: res.status };
}

async function pMap(items, fn, parallel) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker));
  return results;
}

async function main() {
  const dryRun = !process.argv.includes('--delete');
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE MODE: will delete broken items ===');

  const allItems = [];
  for (const slug of SLUGS) {
    const data = JSON.parse(readFileSync(join('data', `${slug}.json`), 'utf-8'));
    for (const c of data.companies) {
      for (const n of c.news) {
        allItems.push({ slug, co: c, item: n });
      }
    }
  }
  console.log(`Total items: ${allItems.length}`);

  const checks = await pMap(allItems, async (it) => {
    const result = await checkItem(it.co.id, it.item);
    return { ...it, result };
  }, PARALLEL);

  let ok = 0, broken = 0;
  const perCompany = {};
  for (const c of checks) {
    const k = `${c.slug}/${c.co.id}`;
    if (!perCompany[k]) perCompany[k] = { ok: [], broken: [] };
    if (c.result.ok) {
      ok++;
      perCompany[k].ok.push(c.item.title.slice(0, 50));
    } else {
      broken++;
      perCompany[k].broken.push({ title: c.item.title.slice(0, 50), url: c.item.url, reason: c.result.reason });
    }
  }

  console.log(`\nOK: ${ok}  Broken: ${broken}`);

  // Apply deletions if not dry-run
  if (!dryRun) {
    for (const slug of SLUGS) {
      const fp = join('data', `${slug}.json`);
      const data = JSON.parse(readFileSync(fp, 'utf-8'));
      let touched = false;
      for (const c of data.companies) {
        const k = `${slug}/${c.id}`;
        const brokenUrls = new Set((perCompany[k]?.broken || []).map(b => b.url));
        if (brokenUrls.size > 0) {
          const before = c.news.length;
          c.news = c.news.filter(n => !brokenUrls.has(n.url));
          if (c.news.length !== before) touched = true;
        }
      }
      if (touched) writeFileSync(fp, JSON.stringify(data, null, 2));
    }
    console.log('\nDeletions applied.');
  }

  // Save report
  writeFileSync('data/link-verify-report.json', JSON.stringify({ ok, broken, perCompany }, null, 2));

  // Per-company broken summary
  console.log(`\n=== BROKEN ITEMS ===`);
  const issues = Object.entries(perCompany).filter(([k, v]) => v.broken.length > 0)
    .sort((a, b) => b[1].broken.length - a[1].broken.length);
  for (const [k, v] of issues) {
    console.log(`\n[${v.broken.length}] ${k}`);
    for (const b of v.broken) {
      console.log(`  ✗ ${b.title}`);
      console.log(`    ${b.url.slice(0, 90)}`);
      console.log(`    → ${b.reason}`);
    }
  }
  if (issues.length === 0) console.log('(none)');
}

main().catch(err => { console.error('✗', err); process.exit(1); });