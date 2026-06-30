#!/usr/bin/env node
// Final cleanup: ABB items still have English brand names in middle.
// Apply manual translations for known brand-name-containing items.

import { readFileSync, writeFileSync } from 'node:fs';

const SLUGS = JSON.parse(readFileSync('data/industries.json', 'utf-8')).industries.map(i => i.slug);

const FIXES = [
  // ABB - keep English brand "Ability™ BuildingPro" but Chinese around
  { match: 'ABB收购Høglund以扩展海事自动化产品组合',
    newTitle: 'ABB收购Høglund以扩展海事自动化业务版图' },
  { match: 'ABB推出Ability™ BuildingPro套件,统一建筑与物联网系统',
    newTitle: 'ABB推出Ability™ BuildingPro套件,统一楼宇与物联网系统实现数据驱动' },
];

let touched = 0;
for (const slug of SLUGS) {
  const fp = `data/${slug}.json`;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let changed = false;
  for (const c of data.companies) {
    for (const n of c.news) {
      for (const fix of FIXES) {
        if (n.title === fix.match) {
          n.title = fix.newTitle;
          changed = true;
          touched++;
        }
      }
    }
  }
  if (changed) writeFileSync(fp, JSON.stringify(data, null, 2));
}
console.log(`Applied ${touched} cleanup fixes.`);