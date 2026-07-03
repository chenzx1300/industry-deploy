#!/usr/bin/env node
// Daily refresh: re-explore all approved news channels, translate, render, push.
//
// Pipeline:
//   1. Run every scripts/refill-*-v1.mjs (each writes its company's 10 news items
//      to data/industries.json — either from hardcoded lists or live API fetches)
//   2. Sync from master to per-slug files (sync-from-master.mjs)
//   3. Translate any new items EN→ZH (translate-news.mjs)
//   4. Re-render docs/ from per-slug files (render-from-json.mjs)
//   5. Git commit + push (idempotent — no-op if no changes)
//
// Designed to run from cron at 6 AM daily. Each step logs to stdout; failures
// in any single refill script are caught and logged but don't abort the run.

import { execSync } from 'node:child_process';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPTS_DIR = 'scripts';
const REFILL_PREFIX = 'refill-';
const REFILL_SUFFIX = '-v1.mjs';
const DATA_DIR = 'data';
const INDUSTRIES_FILE = join(DATA_DIR, 'industries.json');

function run(cmd, opts = {}) {
  console.log(`\n▸ ${cmd}`);
  try {
    const out = execSync(cmd, { encoding: 'utf-8', stdio: 'inherit', ...opts });
    return out;
  } catch (err) {
    console.error(`  ⚠ command failed: ${cmd}`);
    if (opts.throwOnError) throw err;
    return null;
  }
}

function listRefillScripts() {
  return readdirSync(SCRIPTS_DIR)
    .filter(f => f.startsWith(REFILL_PREFIX) && f.endsWith(REFILL_SUFFIX))
    .sort();
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`\n========================================`);
  console.log(` daily-refresh.mjs — ${startedAt}`);
  console.log(`========================================`);

  // Capture pre-refill news count
  let preCount = 0;
  if (existsSync(INDUSTRIES_FILE)) {
    const data = JSON.parse(readFileSync(INDUSTRIES_FILE, 'utf-8'));
    for (const ind of data.industries) {
      for (const c of ind.companies || []) {
        preCount += (c.news || []).length;
      }
    }
  }
  console.log(`\nPre-refresh: ${preCount} news items across all companies`);

  // Step 1: run every refill script
  const scripts = listRefillScripts();
  console.log(`\n[1/5] Running ${scripts.length} refill scripts...`);

  let refillOk = 0;
  let refillFail = 0;
  for (const s of scripts) {
    console.log(`  → ${s}`);
    try {
      execSync(`node ${join(SCRIPTS_DIR, s)}`, { encoding: 'utf-8', stdio: 'pipe' });
      refillOk++;
    } catch (err) {
      console.error(`    ⚠ ${s} failed: ${err.message.split('\n')[0]}`);
      refillFail++;
    }
  }
  console.log(`  refill summary: ${refillOk} ok, ${refillFail} failed`);

  // Post-refill news count
  let postCount = 0;
  if (existsSync(INDUSTRIES_FILE)) {
    const data = JSON.parse(readFileSync(INDUSTRIES_FILE, 'utf-8'));
    for (const ind of data.industries) {
      for (const c of ind.companies || []) {
        postCount += (c.news || []).length;
      }
    }
  }
  console.log(`  Post-refresh: ${postCount} news items (delta: ${postCount - preCount >= 0 ? '+' : ''}${postCount - preCount})`);

  // Step 2a: propagate per-slug writes back to master (in case any refill
  // wrote directly to data/<slug>-industry.json)
  console.log(`\n[2a/5] Sync slug → master (propagate per-slug writes)...`);
  run('node scripts/sync-master-from-slug.mjs', { throwOnError: false });

  // Step 2b: sync master → slug (ensure all slug files are consistent)
  console.log(`\n[2b/5] Sync master → slug files...`);
  run('node scripts/sync-from-master.mjs', { throwOnError: true });

  // Step 3: translate (only new items get a title_zh)
  console.log(`\n[3/5] Translate new items EN→ZH...`);
  run('node scripts/translate-news.mjs', { throwOnError: false });

  // Step 4: re-render
  console.log(`\n[4/5] Re-render docs/...`);
  run('node scripts/render-from-json.mjs', { throwOnError: true });

  // Step 5: git commit + push
  console.log(`\n[5/5] Git commit + push...`);
  try {
    const status = execSync('git status --short', { encoding: 'utf-8' }).trim();
    if (!status) {
      console.log('  No changes to commit.');
      return;
    }
    const lines = status.split('\n');
    console.log(`  ${lines.length} file(s) changed:`);
    for (const l of lines.slice(0, 10)) console.log(`    ${l}`);
    if (lines.length > 10) console.log(`    ... and ${lines.length - 10} more`);

    run('git add data/industries.json docs/', { throwOnError: true });
    const msg = `chore: daily refresh ${startedAt.slice(0, 10)} (${refillOk} refill ok, ${refillFail} failed, Δ${postCount - preCount} news)`;
    run(`git commit -m "${msg}"`, { throwOnError: true });
    run('git push origin main', { throwOnError: true });
    console.log('\n  ✓ daily refresh pushed to GitHub Pages');
  } catch (err) {
    console.error(`  ⚠ git push failed: ${err.message.split('\n')[0]}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`\nFATAL: ${err.message}`);
  process.exit(1);
});
