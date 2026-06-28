#!/usr/bin/env node
// For each company with < TARGET news, navigate to its official news URL
// via Chrome and extract article links.
//
// This is intended to be run interactively from Claude Code, which drives
// Chrome via MCP. Here we instead just emit a "what to visit" list — the
// operator (or a follow-up shell) does the visiting.
//
// To use: run with --dry=false, and ensure Chrome is on a page you control.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
const low = [];
for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  if (!existsSync(fp)) continue;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  for (const c of data.companies) {
    if (c.news.length < TARGET) {
      low.push({ slug: ind.slug, id: c.id, name: c.name, count: c.news.length, url: c.news_url });
    }
  }
}
low.sort((a, b) => a.count - b.count);
console.log(JSON.stringify(low, null, 2));