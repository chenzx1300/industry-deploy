// Smoke test: region tab filtering + hero/section linking.
// Spins up a local HTTP server, loads each industry page in headless Chromium,
// verifies:
//   1. CN tab is active by default
//   2. Only CN company-tabs visible (not INTL)
//   3. Only one .hero visible, one .company-section visible
//   4. Clicking INTL tab shows INTL company-tabs and hides CN ones
//   5. Clicking a company tab shows matching hero+section
//
// Saves screenshots to test/screenshots/.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const DOCS = path.resolve('docs');
const PORT = 4321;

const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const fp = path.join(DOCS, p);
  if (!fp.startsWith(DOCS)) { res.writeHead(403); return res.end(); }
  try {
    const ct = fp.endsWith('.html') ? 'text/html' : 'text/plain';
    res.writeHead(200, { 'Content-Type': ct });
    fs.createReadStream(fp).pipe(res);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

fs.mkdirSync('test/screenshots', { recursive: true });

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(PORT, () => resolve());
});
console.log(`▸ Local server on http://localhost:${PORT}`);

const slug = process.argv[2] || 'semiconductor-industry';
const url = `http://localhost:${PORT}/${slug}/index.html`;
console.log(`▸ Loading ${url}`);
await page.goto(url, { waitUntil: 'domcontentloaded' });

// Derive expected CN/INTL counts from the actual page DOM
const expectedCounts = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.company-tab')];
  const cn = tabs.filter(t => t.dataset.region === 'cn').length;
  const intl = tabs.filter(t => t.dataset.region === 'intl').length;
  return { cn, intl };
});
console.log(`  expected: cn=${expectedCounts.cn} intl=${expectedCounts.intl}`);

// 1. Default region = CN active
const activeRegion = await page.evaluate(() =>
  document.querySelector('.tab-region.active')?.dataset.region
);
console.log(`  active region: ${activeRegion}`);
if (activeRegion !== 'cn') throw new Error('default region should be CN');

// 2. Only CN company-tabs visible
const tabState = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.company-tab')];
  return {
    total: tabs.length,
    visible: tabs.filter(t => !t.hidden).map(t => t.dataset.co),
    hidden: tabs.filter(t => t.hidden).map(t => t.dataset.co),
  };
});
console.log(`  tabs total=${tabState.total} visible=${tabState.visible.length} hidden=${tabState.hidden.length}`);
console.log(`    visible: ${tabState.visible.join(', ')}`);
console.log(`    hidden:  ${tabState.hidden.join(', ')}`);
if (tabState.visible.length !== expectedCounts.cn) throw new Error(`expected ${expectedCounts.cn} visible CN tabs, got ${tabState.visible.length}`);
if (tabState.hidden.length !== expectedCounts.intl) throw new Error(`expected ${expectedCounts.intl} hidden INTL tabs, got ${tabState.hidden.length}`);

// 3. Only one hero + one section visible
const heroCount = await page.locator('.hero[data-co]:not([hidden])').count();
const secCount = await page.locator('.company-section:not([hidden])').count();
console.log(`  visible heroes=${heroCount}, sections=${secCount}`);
if (heroCount !== 1) throw new Error(`expected 1 visible hero, got ${heroCount}`);
if (secCount !== 1) throw new Error(`expected 1 visible section, got ${secCount}`);

await page.screenshot({ path: `test/screenshots/${slug}-1-default.png`, fullPage: false });

// 4. Click INTL region tab
console.log(`\n▸ Clicking INTL region tab`);
await page.click('.tab-region[data-region="intl"]');
await page.waitForTimeout(300);
const tabStateIntl = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.company-tab')];
  return {
    visible: tabs.filter(t => !t.hidden).map(t => t.dataset.co),
    hidden: tabs.filter(t => t.hidden).map(t => t.dataset.co),
  };
});
console.log(`  INTL active — visible: ${tabStateIntl.visible.join(', ')}`);
console.log(`  hidden:                ${tabStateIntl.hidden.join(', ')}`);
if (tabStateIntl.visible.length !== expectedCounts.intl) throw new Error(`after INTL: expected ${expectedCounts.intl} visible tabs, got ${tabStateIntl.visible.length}`);
if (tabStateIntl.hidden.length !== expectedCounts.cn) throw new Error(`after INTL: expected ${expectedCounts.cn} hidden tabs, got ${tabStateIntl.hidden.length}`);
const heroIntl = await page.locator('.hero[data-co]:not([hidden])').count();
const secIntl = await page.locator('.company-section:not([hidden])').count();
console.log(`  visible heroes=${heroIntl}, sections=${secIntl}`);
if (heroIntl !== 1 || secIntl !== 1) throw new Error('after INTL: expected 1 hero + 1 section');
await page.screenshot({ path: `test/screenshots/${slug}-2-intl.png`, fullPage: false });

// 5. Click 2nd INTL company tab — hero + section should switch
if (tabStateIntl.visible.length < 2) throw new Error('need at least 2 INTL tabs');
const secondVisibleCo = tabStateIntl.visible[1];
console.log(`\n▸ Clicking 2nd INTL tab: ${secondVisibleCo}`);
await page.click(`.company-tab[data-co="${secondVisibleCo}"]`);
await page.waitForTimeout(300);
const heroAfter = await page.evaluate(() => {
  const h = document.querySelector('.hero[data-co]:not([hidden])');
  return h?.dataset.co;
});
const secAfter = await page.evaluate(() => {
  const s = document.querySelector('.company-section:not([hidden])');
  return s?.dataset.co;
});
console.log(`  hero co=${heroAfter}, section co=${secAfter}`);
if (heroAfter !== secondVisibleCo) throw new Error(`expected hero=${secondVisibleCo}, got ${heroAfter}`);
if (secAfter !== secondVisibleCo) throw new Error(`expected section=${secondVisibleCo}, got ${secAfter}`);
await page.screenshot({ path: `test/screenshots/${slug}-3-second.png`, fullPage: false });

// 6. Cross-region click (INTL active → click CN tab)
console.log(`\n▸ Cross-region: clicking CN region tab`);
await page.click('.tab-region[data-region="cn"]');
await page.waitForTimeout(300);
const tabStateBack = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.company-tab')];
  return tabs.filter(t => !t.hidden).map(t => t.dataset.co);
});
console.log(`  CN re-activated — visible: ${tabStateBack.join(', ')}`);
if (tabStateBack.length !== expectedCounts.cn) throw new Error('cross-region click failed');

await server.close();
await browser.close();
console.log(`\n✓ ${slug} OK`);