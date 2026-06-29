#!/usr/bin/env node
// Strip irrelevant news from data/<slug>.json. An item is "irrelevant" if
// the title:
//   1. Does NOT mention the company's Chinese or English name
//   2. OR mentions a clearly different company as the primary subject
//
// Operates on a strict heuristic: the company's name (Chinese + English
// tokens) must appear in the title, unless the title is clearly about the
// industry segment.
//
// Usage: node scripts/cleanup-irrelevant.mjs [--dry]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SLUGS = ['semiconductor-industry','new-energy-vehicles-industry','carbon-fiber-industry','thermal-materials-industry','composite-insulator-industry','datacenter-cooling-industry'];
const DRY = process.argv.includes('--dry');

// A list of "competitor / different company" names that, if present in
// title, indicate the item is about a different company (unless our
// company name is also present).
const KNOWN_OTHER_COMPANIES = {
  // Chinese
  '扬杰科技': 'kingfa', '晶方科技': 'kingfa', '金发科技': null, // 金发 IS kingfa
  '特斯拉': 'jushi', '中国电信': 'jushi', '中国移动': 'jushi',
  '万科': null, '恒大': null,
  '谷歌': 'teijin', 'meta': 'teijin', 'google': 'teijin',
  '威卡': 'solvay', '威纶': 'jlhx', 'weilin': 'jlhx',
  '海为': 'jlhx', '台达': 'jlhx', 'dvp': 'jlhx',
  '扬杰': 'kingfa',
  '大连森垚': 'dalian', '森垚': 'dalian',
  'itmedia': 'nidec', 'nikkei': 'nidec',
  '珂玛': 'ztt', '臻宝': 'ztt', '起帆': 'ztt', '万马': 'ztt', '上上': 'ztt', '远东': 'ztt', '航天电工': 'ztt',
  '龙蟠': 'bosom', '扬杰': 'kingfa',
  'j599': 'caoe',
  '意大利': 'solvay', 'italy': 'solvay', '汞': 'solvay',
  'nvidia': 'abb', // psyonic + nvidia + abb is not about abb
};

function getTokens(company) {
  const name = company.name || '';
  // Split by space/comma and Chinese punctuation; also include short prefixes
  const tokens = name.split(/[\s,，、/]+/).filter(Boolean);
  const result = new Set();
  for (const t of tokens) {
    if (t.length >= 2) result.add(t);
    // For Chinese, also add 2/3/4-char prefixes (e.g. "三星电子" -> "三星", "三星电", "三星电子")
    if (/[一-龥]/.test(t)) {
      for (const len of [2, 3, 4]) {
        if (t.length >= len) result.add(t.slice(0, len));
      }
    }
    // For English, lowercase
    if (/^[A-Za-z]/.test(t)) {
      result.add(t.toLowerCase());
      // Also add first 3/4 chars
      for (const len of [3, 4]) {
        if (t.length >= len) result.add(t.slice(0, len).toLowerCase());
      }
    }
  }
  return result;
}

function isRelevant(company, item) {
  const title = item.title || '';
  const tokens = getTokens(company);
  const lower = title.toLowerCase();
  // 1. Title must mention the company name in some form
  const hasName = [...tokens].some(t => lower.includes(t.toLowerCase()));
  if (!hasName) return false;
  // 2. Title must NOT mention a clearly different company as the primary subject
  for (const [other, owner] of Object.entries(KNOWN_OTHER_COMPANIES)) {
    if (owner && owner === company.id) {
      // Check if the title mentions the other company
      if (lower.includes(other.toLowerCase())) {
        // But if our name also appears, it's OK
        if (!hasName) return false;
        // If the other company is the first/primary mention, reject
        const otherIdx = lower.indexOf(other.toLowerCase());
        const ourIdx = lower.search(new RegExp([...tokens].filter(t => t.length >= 3).join('|'), 'i'));
        if (otherIdx < ourIdx) return false;
      }
    }
  }
  return true;
}

let totalRemoved = 0;
for (const slug of SLUGS) {
  const fp = join('data', `${slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;
  for (const c of data.companies) {
    const before = c.news.length;
    c.news = c.news.filter(n => isRelevant(c, n));
    const after = c.news.length;
    if (before !== after) {
      console.log(`${slug}/${c.id}: ${before} → ${after} (removed ${before - after})`);
      touched = true;
      totalRemoved += (before - after);
    }
  }
  if (touched && !DRY) writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

console.log(`\n${DRY ? '[DRY] ' : ''}Total removed: ${totalRemoved}`);
