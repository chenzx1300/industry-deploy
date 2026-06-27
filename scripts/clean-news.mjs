#!/usr/bin/env node
// Clean 4 industry JSONs:
//   1. Drop whole items where the title itself is a placeholder
//      (e.g. "Jushi Holdings Inc JUSHF") — these are stock-quote scraper
//      failures, not real news.
//   2. Drop whole items where snippet is clearly an anti-bot / geo-block page
//      (URL is also blocked — keeping the title would mislead users).
//   3. Clear snippet (keep item) where snippet has "soft" block indicators
//      that might appear in a legitimate news article.
//   4. Deduplicate within an industry: same URL or same title → keep first.
//
// Run: node scripts/clean-news.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const SLUGS = ['semiconductor-industry','new-energy-vehicles-industry','carbon-fiber-industry','thermal-materials-industry'];

// "Hard" block-page indicators — when the snippet ONLY contains bot/geo-block
// content, the linked URL is also blocked. Drop the whole item.
// Keep this list SHORT and unambiguous: false positives here = lost news.
const SNIPPET_BLOCKED_FULL = [
  /该网站正在使用安全服务/,                          // thenextweb CF challenge (CN)
  /触发(?:了)?\s*安全(?:解决方案|检查|验证)/,
  /Yahoo.*?中国大陆(无法|不能|暂停).*?使用/s,         // Yahoo CN geo block
  /2021\s*年\s*11\s*月\s*1\s*日.*?Yahoo.*?无法.*?使用/s,
  /请禁用\s*Google Translate/s,
  /(?:please )?(?:click|tap).{0,20}(?:box|button).{0,30}(?:verify|robot|human)/i,
];

// "Soft" block-page indicators — could appear in a real news article about
// security/CDN. When matched, we clear the snippet only and keep the item.
const SNIPPET_SOFT_BLOCK = [
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

// Title patterns where the TITLE itself is a placeholder / stock quote.
const TITLE_BAD_PATTERNS = [
  /^News tagged\s+/i,
  /^(?:NEWS|NEWSWIRE)\s+TAGGED/i,
  /\b(?:JUSHF|JUSH|JULH|TOR1)\b\s*$/i,
  /^Jushi Holdings Inc\s*JUSHF?$/i,
  /^.{3,40}\s+Holdings Inc\s+[A-Z]{3,5}$/,
  /^(?:View|Read) (?:All |latest )?[A-Z][a-z]+\s+news/i,
];

function isHardBlocked(n) {
  const blob = (n.title || '') + '\n' + (n.snippet || '');
  for (const p of SNIPPET_BLOCKED_FULL) if (p.test(blob)) return true;
  return false;
}
function isSoftBlocked(snippet) {
  if (!snippet) return false;
  for (const p of SNIPPET_SOFT_BLOCK) if (p.test(snippet)) return true;
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

      // 2. Hard block (URL is also blocked) → drop whole item
      if (isHardBlocked(n)) {
        dropped++;
        droppedItems.push({ co: c.id, title: title.slice(0, 60), reason: 'hard block page' });
        continue;
      }

      // 3. Soft block (might be real article) → clear snippet only
      let newSnippet = snippet;
      if (isSoftBlocked(snippet)) {
        newSnippet = '';
        cleaned++;
        cleanedItems.push({ co: c.id, title: title.slice(0, 60) });
      }

      // 4. Dedup by URL then by title
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

  console.log(`▸ ${slug}: dropped ${dropped} (incl. hard blocks), cleaned ${cleaned} snippets, deduped ${dedup}, final ${report.bySlug[slug].final_news} news`);
  for (const x of droppedItems) console.log(`    drop [${x.co}] ${x.reason || 'bad title'}: ${x.title}`);
}

writeFileSync(join(DATA_DIR, 'clean-report.json'), JSON.stringify(report, null, 2), 'utf-8');
console.log(`\n✓ Total: ${report.total.cleaned_snippets} snippets cleaned, ${report.total.dropped_items} items dropped, ${report.total.dedup_removed} deduped → data/clean-report.json`);