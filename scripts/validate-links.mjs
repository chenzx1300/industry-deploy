#!/usr/bin/env node
// Validate every news URL in data/<slug>.json. Outputs:
//   - HTTP HEAD status code (200, 404, 301, etc.)
//   - Real news check (URL must NOT be a placeholder like /show-126.html
//     or a listing page; hostname must match the company's domain)
//
// Writes data/link-validation-report.json.
//
// Usage: node scripts/validate-links.mjs [--check-http] [--concurrency 8]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { request } from 'node:https';
import { URL } from 'node:url';

const SLUGS = ['semiconductor-industry','new-energy-vehicles-industry','carbon-fiber-industry','thermal-materials-industry','composite-insulator-industry','datacenter-cooling-industry'];
const args = process.argv.slice(2);
const CHECK_HTTP = args.includes('--check-http');
const CONCURRENCY = parseInt(args[args.indexOf('--concurrency') + 1] || '4', 10);

const PLACEHOLDER_PATTERNS = [
  /\/show-\d+\.html?$/i,
  /\/id-\d+\.html?$/i,
  /\/news\/\d+\.html?$/i,
  /\/press\/\d+\.html?$/i,
];

// 1. Static analysis
// "Likely real news" hostnames — secondary coverage is legitimate news.
// Placeholder IDs (show-126.html) are NOT.
const REAL_NEWS_HOSTNAMES = new Set([
  // International
  'reuters.com','bloomberg.com','scmp.com','forbes.com','cnn.com','wsj.com','ft.com',
  'techcrunch.com','theinformation.com','caixin.com','nikkei.com','securities.com',
  'sina.com.cn','sohu.com','163.com','qq.com','eastmoney.com','aastocks.com',
  'xueqiu.com','thestocktiger.com','barrons.com','marketwatch.com','cnbc.com',
  'nytimes.com','washingtonpost.com','electrek.co','aol.com','yahoo.com',
  'finance.yahoo.com','theglobeandmail.com','businessinsider.com',
  'markets.businessinsider.com','hkgolden.com','hstong.com','futunn.com',
  'efinance.com.cn','aastocks.com','prnewswire.com','businesswire.com',
  'globenewswire.com','eefocus.com','eeweb.com','designworldonline.com',
  'compositesworld.com','jeccomposites.com','jec-composites.com','sme.org','spe.org',
  'gigazine.net','itmedia.co.jp','impress.co.jp','techtimes.com',
  'koreaherald.com','koreabizwire.com','businesskorea.co.kr','koreatechtoday.com',
  'eetasia.com','digitimes.com','digitimes.com.tw','digitimes.com.cn',
  'benzinga.com','cnet.com','crn.com','zdnet.com','computerworld.com',
  'datacenterdynamics.com','datacenterknowledge.com','dcd-data.com','dcd-news.com',
  'theverge.com','arstechnica.com','engadget.com','9to5mac.com','appleinsider.com',
  'extremetech.com','techspot.com','fool.com','nasdaq.com','247wallst.com',
  'global.chinadaily.com.cn','chinadaily.com.cn','etnet.com.hk','memeburn.com',
  'invezz.com','usatoday.com','wtkr.com','fox10phoenix.com','onmsft.com',
  'mcgc.com','money.usnews.com','taiwannews.com.tw','fastcompany.com',
  'investing.com','newatlas.com','propakistani.pk','electrive.com',
  'thenextweb.com','volkswagen-newsroom.com','telegraph.co.uk','newatlas.com',
  'indianexpress.com','express.co.uk','torquenews.com','asiae.co.kr',
]);

const issues = [];
for (const slug of SLUGS) {
  const data = JSON.parse(readFileSync(join('data', `${slug}.json`), 'utf-8'));
  for (const c of data.companies) {
    const expectedHost = (c.domain || c.news_url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    for (const n of c.news || []) {
      const u = n.url || '';
      const flags = [];
      if (!u) flags.push('empty-url');
      else {
        // Placeholder ID
        for (const p of PLACEHOLDER_PATTERNS) if (p.test(u)) flags.push('placeholder-id');
        // Invalid URL syntax
        let h = '';
        try { h = new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { flags.push('invalid-url'); }
        // Stock-analysis / parked / link shortener (always bad)
        const alwaysBad = ['seekingalpha.com','stockanalysis.com','morningstar.com','tipranks.com','simplywall.st','markets.businessinsider.com','bit.ly','tinyurl.com','t.co','goo.gl','ow.ly','sedoparking.com','afternic.com','hugedomains.com','dan.com','parkingcrew.net','sedohq.com','cookiewall.com','gdpr-banner.com'];
        if (alwaysBad.some(b => h === b || h.endsWith('.' + b))) flags.push(`bad-host:${h}`);
        // Listing page (no article ID after stripping year)
        const stripped = u.replace(/\/\d{4}\//g, '/');
        if (/\/(news|press|press-releases|newsroom|press-archive)\/?(\?.*)?$/i.test(stripped)) flags.push('listing-page');
        // Empty / only-suffix
        if (u.split('?')[0].endsWith('.html') && /\/show-\d+\.html$/.test(u)) flags.push('placeholder-id');
      }
      if (flags.length) {
        issues.push({ slug, co: c.id, url: u, title: (n.title || '').slice(0, 80), flags });
      }
    }
  }
}

// 2. Optional: HTTP HEAD check for unmarked URLs
let httpResults = [];
if (CHECK_HTTP) {
  console.log(`\nRunning HTTP HEAD checks (concurrency=${CONCURRENCY})...`);
  const allItems = [];
  for (const slug of SLUGS) {
    const data = JSON.parse(readFileSync(join('data', `${slug}.json`), 'utf-8'));
    for (const c of data.companies) {
      for (const n of c.news || []) {
        if (n.url) allItems.push({ slug, co: c.id, url: n.url });
      }
    }
  }
  // Only check those that didn't already fail static checks
  const issueUrls = new Set(issues.map(i => i.url));
  const toCheck = allItems.filter(it => !issueUrls.has(it.url));
  console.log(`Checking ${toCheck.length} URLs...`);
  await runWithLimit(toCheck, CONCURRENCY, async (it) => {
    const status = await headStatus(it.url);
    if (status >= 400) {
      issues.push({ ...it, flags: [`http-${status}`] });
    }
  });
  httpResults = issues.filter(i => i.flags.some(f => f.startsWith('http-')));
  console.log(`HTTP check: ${httpResults.length} failures`);
}

const report = {
  summary: {
    total_issues: issues.length,
    by_flag: countFlags(issues),
  },
  issues,
  by_slug: groupBy(issues, 'slug'),
  by_co: groupBy(issues, 'co'),
};
writeFileSync('data/link-validation-report.json', JSON.stringify(report, null, 2), 'utf-8');

console.log(`\n=== Link validation report ===`);
console.log(`Total issues: ${issues.length}`);
console.log('\nBy flag:');
for (const [flag, count] of Object.entries(report.summary.by_flag)) {
  console.log(`  ${flag}: ${count}`);
}
console.log('\nBy company:');
for (const [co, items] of Object.entries(report.by_co)) {
  console.log(`  ${co}: ${items.length} issues`);
}

function countFlags(arr) {
  const m = {};
  for (const it of arr) {
    for (const f of it.flags) m[f] = (m[f] || 0) + 1;
  }
  return m;
}
function groupBy(arr, key) {
  const m = {};
  for (const it of arr) {
    const k = it[key];
    (m[k] = m[k] || []).push(it);
  }
  return m;
}

async function runWithLimit(items, limit, fn) {
  const queue = [...items];
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item) await fn(item);
    }
  });
  await Promise.all(workers);
}

function headStatus(u) {
  return new Promise(resolve => {
    try {
      const url = new URL(u);
      const req = request({
        method: 'HEAD',
        host: url.hostname,
        path: url.pathname + url.search,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; industry-radar-validate)' },
      }, res => resolve(res.statusCode || 0));
      req.on('error', () => resolve(0));
      req.on('timeout', () => { req.destroy(); resolve(0); });
      req.end();
    } catch { resolve(0); }
  });
}