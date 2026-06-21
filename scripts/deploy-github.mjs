#!/usr/bin/env node
// One-shot deploy to GitHub Pages. Reads token from ~/.claude/projects/F--claude/memory/github-token-only.txt.
// Usage: node scripts/deploy-github.mjs [repo-name]
//
// Requires: GITHUB_USERNAME env var (or set in .env)
// The repo must already exist OR the token must have permission to create it.

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, basename } from 'node:path';
import { homedir } from 'node:os';

const TOKEN_FILE = `${homedir()}/.claude/projects/F--claude/memory/github-token-only.txt`;
const PROJECT_DIR = resolve(process.cwd());
const REPO_NAME = process.argv[2] || basename(PROJECT_DIR);
const USERNAME = process.env.GITHUB_USERNAME || 'chenzx1300'; // edit if needed

if (!existsSync(TOKEN_FILE)) {
  console.error(`✗ Token file not found: ${TOKEN_FILE}`);
  console.error(`  Save your GitHub PAT to that file and retry.`);
  process.exit(1);
}
const TOKEN = readFileSync(TOKEN_FILE, 'utf-8').trim();

function curl(method, url, body = null) {
  const args = ['-sS', '-X', method, '-H', `Authorization: Bearer ${TOKEN}`, '-H', 'Accept: application/vnd.github+json'];
  if (body) {
    args.push('-H', 'Content-Type: application/json', '-d', body);
  }
  args.push(url);
  const res = spawnSync('curl', args, { encoding: 'utf-8' });
  if (res.status !== 0) throw new Error(`curl failed: ${res.stderr}`);
  return JSON.parse(res.stdout);
}

async function main() {
  console.log(`▸ Deploying ${USERNAME}/${REPO_NAME} to GitHub Pages...\n`);

  // 1. Verify token
  console.log(`1. Verifying token...`);
  const user = curl('GET', 'https://api.github.com/user');
  console.log(`   ✓ Logged in as ${user.login}\n`);

  // 2. Check / create repo
  console.log(`2. Checking repo ${USERNAME}/${REPO_NAME}...`);
  const status = spawnSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '-H', `Authorization: Bearer ${TOKEN}`, `https://api.github.com/repos/${USERNAME}/${REPO_NAME}`], { encoding: 'utf-8' }).stdout;
  if (status === '404') {
    console.log(`   Repo not found. Creating...`);
    curl('POST', 'https://api.github.com/user/repos', JSON.stringify({
      name: REPO_NAME,
      description: 'Industry news radar',
      private: false,
    }));
    console.log(`   ✓ Created\n`);
  } else {
    console.log(`   ✓ Exists\n`);
  }

  // 3. Configure git remote + push
  console.log(`3. Configuring git remote and pushing...`);
  const remoteUrl = `https://oauth2:${TOKEN}@github.com/${USERNAME}/${REPO_NAME}.git`;
  spawnSync('git', ['remote', 'remove', 'origin'], { cwd: PROJECT_DIR });
  spawnSync('git', ['remote', 'add', 'origin', remoteUrl], { cwd: PROJECT_DIR });
  // Rename master → main if needed
  spawnSync('git', ['branch', '-m', 'master', 'main'], { cwd: PROJECT_DIR });
  const pushRes = spawnSync('git', ['push', '-u', 'origin', 'main'], { cwd: PROJECT_DIR, encoding: 'utf-8' });
  if (pushRes.status !== 0) {
    console.error(`   ✗ Push failed: ${pushRes.stderr}`);
    process.exit(1);
  }
  console.log(`   ✓ Pushed\n`);

  // 4. Enable Pages
  console.log(`4. Enabling GitHub Pages (source: main / /docs)...`);
  try {
    curl('POST', `https://api.github.com/repos/${USERNAME}/${REPO_NAME}/pages`, JSON.stringify({
      source: { branch: 'main', path: '/docs' },
    }));
  } catch (err) {
    console.log(`   (Pages may already be enabled: ${err.message})`);
  }
  console.log(`   ✓ Pages configured\n`);

  // 5. Verify
  console.log(`5. Verifying deployment (waiting 30s for build)...`);
  await new Promise(r => setTimeout(r, 30000));
  const baseUrl = `https://${USERNAME}.github.io/${REPO_NAME}`;
  for (const path of ['', 'index.html']) {
    const url = `${baseUrl}/${path}`;
    const code = spawnSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', url], { encoding: 'utf-8' }).stdout;
    console.log(`   ${code}  ${url}`);
  }

  console.log(`\n✓ Done. Site will be live at:`);
  console.log(`  ${baseUrl}/`);
}

main().catch(err => { console.error(`✗ ${err.message}`); process.exit(1); });