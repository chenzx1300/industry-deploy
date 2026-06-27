#!/usr/bin/env node
// Clean 4 industry JSONs:
//   1. Drop snippets that are clearly anti-bot / geo-block messages
//      (Yahoo China block, Cloudflare verify, captcha challenges, etc.)
//   2. Drop entire news items where the title itself is a placeholder
//      (e.g. "<Company Name> Holdings Inc JUSH") — these are stock-quote
//      scraper failures, not real news.
//   3. Deduplicate within an industry: same URL or same title across
//      companies → keep first occurrence.
// Writes a report to data/clean-report.json.
//
// Run: node scripts/clean-news.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const SLUGS = ['semiconductor-industry','new-energy-vehicles-industry','carbon-fiber-industry','thermal-materials-industry'];

// Snippet patterns that indicate the content is an anti-bot / geo-block page,
// NOT real news content. Match against the snippet only — title is preserved.
const SNIPPET_BAD_PATTERNS = [
  /2021\s*年\s*11\s*月\s*1\s*日.*?Yahoo.*?无法.*?使用/s,        // Yahoo CN block
  /Yahoo.*?中国大陆(无法|不能|暂停).*?使用/s,
  /请禁用\s*Google Translate/s,
  /please click the box below to let us know you'?re not a robot/i,
  /确认您不是机器人/,
  /(?:点击|请).*?(?:方框|按钮).*?(?:确认|证明|验证).*?(?:不是|非)\s*机器人?/,
  /不是\s*(?:机器人|机器)/,
  /security service to protect against (malicious )?bots?/i,
  /Access Denied|403 Forbidden/i,
  /errors\.edgesuite\.net/i,
  /EdgeSuite/i,
  /Verifying you are human|Verifying your browser|Verify you are human/i,
  /(?:please\s+)?complete (?:the )?(?:security check|captcha|challenge)/i,
  /This page is displayed while the website verifies/i,
  /We are sorry.{0,40}unavailable/i,
  /(?:site|service|page).{0,20}(?:is )?(?:been )?(?:temporarily )?(?:suspended|paused|unavailable|taken down|disabled)/i,
  /网站(?:正在)?(?:维护|暂停)/,
  /Page Not Found|404 Not Found/i,
  /please enable javascript/i,
  /your browser.{0,30}(blocked|detected|flagged)/i,
  /(?:cloudscraper|cloudflare)/i,
];

// Title patterns where the TITLE itself is a placeholder / stock quote, not real news.
// These whole items are removed.
const TITLE_BAD_PATTERNS = [
  /^News tagged\s+/i,                          // "News tagged HUA HONG SEMICONDUCTOR"
  /^(?:NEWS|NEWSWIRE)\s+TAGGED/i,
  /\b(?:JUSHF|JUSH|JULH|TOR1)\b\s*$/i,        // "Jushi Holdings Inc JUSHF" — pure ticker
  /^Jushi Holdings Inc\s*JUSHF?$/i,
  /^.{3,40}\s+Holdings Inc\s+[A-Z]{3,5}$/,    // "<Company> Holdings Inc TICKER"
  /^(?:View|Read) (?:All |latest )?[A-Z][a-z]+\s+news/i,
];

function isBadSnippet(snippet) {
  if (!snippet) return false;
  for (const p of SNIPPET_BAD_PATTERNS) if (p.test(snippet)) return true;
  return false;
}
function isBadTitle(title) {
  if (!title) return false;
  for (const p of TITLE_BAD_PATTERNS) if (p.test(title)) return true;
  return false;
}

const report = { bySlug: {}, total: { cleaned_snippets: 0, dropped_items: 0, dedup_removed: 0 } };

for (const slug of SLUGS) {
  const fp = join(DATA_DIR, `${slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let cleaned = 0, dropped = 0, dedup = 0;
  const seenUrls = new Set();
  const seenTitles = new Set();
  const droppedItems = [];
  const cleanedItems = [];
  const dedupItems = [];

  for (const c of data.companies) {
    const kept = [];
    for (const n of c.news) {
      const title = n.title || '';
      const snippet = n.snippet || '';

      // 1. Bad title → drop whole item
      if (isBadTitle(title)) {
        dropped++;
        droppedItems.push({ co: c.id, title });
        continue;
      }

      // 2. Bad snippet → clear snippet only
      let newSnippet = snippet;
      if (isBadSnippet(snippet)) {
        newSnippet = '';
        cleaned++;
        cleanedItems.push({ co: c.id, title: title.slice(0, 60) });
      }

      // 3. Dedup by URL then by title
      if (seenUrls.has(n.url) || seenTitles.has(title.toLowerCase())) {
        dedup++;
        dedupItems.push({ co: c.id, title: title.slice(0, 60) });
        continue;
      }
      seenUrls.add(n.url);
      seenTitles.add(title.toLowerCase());

      kept.push({ ...n, snippet: newSnippet });
    }
    c.news = kept;
  }

  writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
  report.bySlug[slug] = {
    companies: data.companies.length,
    cleaned_snippets: cleaned,
    dropped_items: dropped,
    dedup_removed: dedup,
    final_news: data.companies.reduce((s, c) => s + c.news.length, 0),
  };
  report.total.cleaned_snippets += cleaned;
  report.total.dropped_items += dropped;
  report.total.dedup_removed += dedup;

  console.log(`▸ ${slug}: cleaned ${cleaned} snippets, dropped ${dropped} items, deduped ${dedup}, final ${report.bySlug[slug].final_news} news`);
  if (droppedItems.length) {
    console.log('  dropped titles:');
    for (const x of droppedItems.slice(0, 8)) console.log(`    [${x.co}] ${x.title}`);
  }
}

writeFileSync(join(DATA_DIR, 'clean-report.json'), JSON.stringify(report, null, 2), 'utf-8');
console.log(`\n✓ Total: ${report.total.cleaned_snippets} snippets cleaned, ${report.total.dropped_items} items dropped, ${report.total.dedup_removed} deduped → data/clean-report.json`);