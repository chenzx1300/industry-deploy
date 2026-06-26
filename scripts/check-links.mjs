#!/usr/bin/env node
// Link health checker: verify that every news URL in every industry JSON file
// returns 2xx (or 3xx redirect). Reports broken links so the daily cron can
// surface them in the GitHub issue.
//
// Usage: node scripts/check-links.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CONCURRENCY = 12;
const TIMEOUT = 10000;

// Domains that are known to return non-2xx for bots but render fine in browsers.
// Skip those in the check (we already know they're fine).
const BOT_BLOCKED_DOMAINS = [
  'youtube.com', 'youtu.be', 'vimeo.com',
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'linkedin.com',
  // Paywall / bot-blocked news sites that block headless requests
  'finance.yahoo.com', 'aol.com', 'reuters.com', 'barrons.com',
  'nasdaq.com', 'onmsft.com', 'venturebeat.com', '247wallst.com',
  'pr.tsmc.com', 'investor.tsmc.com',  // TSMC blocks headless
  'bydglobal.com',  // slow + bot-protected
  'solvay.com',     // 403 for press releases from automated clients
];

async function checkUrl(url) {
  // Retry transient network errors up to 2 times before declaring broken
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const u = new URL(url);
      if (BOT_BLOCKED_DOMAINS.some(d => u.hostname.includes(d))) {
        return { url, status: 'skip', note: 'known-bot-protected' };
      }
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': BROWSER_UA, 'Range': 'bytes=0-0' },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      try { await res.arrayBuffer(); } catch {}
      const ok = res.status >= 200 && res.status < 400;
      return {
        url,
        status: res.status,
        ok,
        finalUrl: res.url !== url ? res.url : null,
      };
    } catch (err) {
      if (attempt === 2) {
        return { url, status: 'error', error: err.message?.slice(0, 80) };
      }
      // Brief backoff before retry
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

async function main() {
  const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  const industries = config.industries || [];

  // Collect all URLs
  const allUrls = [];
  for (const ind of industries) {
    const slug = ind.slug;
    const dataPath = join(DATA_DIR, slug + '.json');
    let data;
    try { data = JSON.parse(readFileSync(dataPath, 'utf-8')); } catch { continue; }
    for (const c of (data.companies || [])) {
      for (const n of (c.news || [])) {
        if (!n.url || n.url.startsWith('javascript:')) continue;
        allUrls.push({ industry: slug, company: c.name, title: n.title, url: n.url });
      }
    }
  }

  console.log(`▸ Checking ${allUrls.length} URLs across ${industries.length} industries...\n`);

  // Run with limited concurrency
  const results = [];
  for (let i = 0; i < allUrls.length; i += CONCURRENCY) {
    const batch = allUrls.slice(i, i + CONCURRENCY);
    const out = await Promise.all(batch.map(async (item) => {
      const r = await checkUrl(item.url);
      return { ...item, ...r };
    }));
    results.push(...out);
    process.stdout.write(`  ${results.length}/${allUrls.length}\r`);
  }
  process.stdout.write('\n');

  // Categorize
  const ok = results.filter(r => r.ok);
  const broken = results.filter(r => !r.ok && r.status !== 'skip');
  const skipped = results.filter(r => r.status === 'skip');

  console.log(`✓ OK: ${ok.length}`);
  console.log(`✗ Broken: ${broken.length}`);
  console.log(`- Skipped: ${skipped.length}`);

  if (broken.length > 0) {
    console.log(`\nBroken links:`);
    for (const b of broken) {
      console.log(`  ${b.industry}/${b.company} [${b.status}]: ${b.title.slice(0,50)}`);
      console.log(`    ${b.url}`);
      if (b.error) console.log(`    ${b.error}`);
    }
  }

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    total: allUrls.length,
    ok: ok.length,
    broken: broken.length,
    skipped: skipped.length,
    broken_details: broken.map(b => ({
      industry: b.industry,
      company: b.company,
      title: b.title,
      url: b.url,
      status: b.status,
      error: b.error,
    })),
  };
  const fs = await import('node:fs/promises');
  await fs.writeFile(join(DATA_DIR, 'link-health.json'), JSON.stringify(report, null, 2));
  console.log(`\n✓ Report written to data/link-health.json`);
  console.log(`Broken link ratio: ${(broken.length / allUrls.length * 100).toFixed(1)}%`);
}

main().catch(err => { console.error('✗ Fatal:', err); process.exit(1); });