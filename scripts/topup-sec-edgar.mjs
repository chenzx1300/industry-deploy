#!/usr/bin/env node
// SEC EDGAR topup for US-listed companies + IR press release scraping
// for non-US companies. Uses SEC's JSON API for reliable date metadata.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);
const CUTOFF = new Date('2025-06-30T00:00:00Z');
const UA = 'Mozilla/5.0 chenzx1300-industry-deploy@example.com';

// Map: company id -> { ticker, cik, name }
const SEC_COMPANIES = {
  nvidia: { ticker: 'NVDA', cik: '0001045810', name: 'NVIDIA' },
  intel: { ticker: 'INTC', cik: '0000050863', name: 'Intel' },
  tsmc: { ticker: 'TSM', cik: '0001046179', name: 'Taiwan Semiconductor' },
  nio: { ticker: 'NIO', cik: '0001736541', name: 'NIO' },
  xpeng: { ticker: 'XPEV', cik: '0001810997', name: 'XPeng' },
  li: { ticker: 'LI', cik: '0001791706', name: 'Li Auto' },
  abb: { ticker: 'ABB', cik: '0001091587', name: 'ABB' },
  hubbell: { ticker: 'HUBB', cik: '0000048898', name: 'Hubbell' },
  teconnectivity: { ticker: 'TEL', cik: '0001385157', name: 'TE Connectivity' },
  vertiv: { ticker: 'VRT', cik: '0001674101', name: 'Vertiv' },
  honeywell: { ticker: 'HON', cik: '0000773840', name: 'Honeywell' },
};

async function fetchSecFilings(cik) {
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    const recent = j.filings.recent;
    const out = [];
    for (let i = 0; i < recent.form.length; i++) {
      // Only material filings: 8-K (current report), 10-Q, 10-K, S-1, DEF 14A
      const form = recent.form[i];
      // US domestic: 8-K, 10-Q, 10-K. Foreign Private Issuers: 6-K, 20-F, F-3, 424B
      if (!['8-K', '10-Q', '10-K', '6-K', '20-F', 'F-3', 'F-1', '424B', 'S-1', 'DEF 14A', 'SC 13G'].includes(form)) continue;
      const date = new Date(recent.filingDate[i] + 'T00:00:00Z');
      if (date < CUTOFF) continue;
      const accNo = recent.accessionNumber[i].replace(/-/g, '');
      const primaryDoc = recent.primaryDocument[i];
      const filingUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accNo}/${primaryDoc}`;
      const desc = (recent.primaryDocDescription[i] || '').trim();
      // Human-readable title; falls back to form + accession if desc is empty
      const title = desc ? `${sec.name} ${form}: ${desc}` : `${sec.name} ${form} (${recent.accessionNumber[i]})`;
      out.push({
        title,
        url: filingUrl,
        date,
        form,
        accession: recent.accessionNumber[i],
      });
      if (out.length >= 40) break;
    }
    return out;
  } catch { return []; }
}

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));

for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  if (!existsSync(fp)) continue;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;

  for (const c of data.companies) {
    if (c.news.length >= TARGET) continue;
    const sec = SEC_COMPANIES[c.id];
    if (!sec) continue;
    const need = TARGET - c.news.length;
    console.log(`\n▸ ${ind.slug}/${c.id} (${c.name}): have ${c.news.length}, need ${need}`);

    const filings = await fetchSecFilings(sec.cik);
    console.log(`  filings: ${filings.length}`);
    const seen = new Set(c.news.map(n => n.url));
    const now = new Date().toISOString();
    let added = 0;
    for (const f of filings) {
      if (c.news.length >= TARGET) break;
      if (seen.has(f.url)) continue;
      seen.add(f.url);
      c.news.push({
        title: f.title,
        url: f.url,
        snippet: '',
        published_at: f.date.toISOString(),
        fetched_at: now,
        source: 'sec.gov',
      });
      added++;
    }
    console.log(`  ✓ added ${added} (now ${c.news.length}/${TARGET})`);
    touched = true;
  }

  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2));
}

console.log('\n=== Done ===');