// News center scraper: fetches a company's news page and extracts individual
// article (title, url) pairs. Used to resolve Google News RSS titles to their
// actual article URLs on the publisher's site (so users in China land on
// the real article, not a Google News redirect that may be blocked).
//
// Strategy:
//   1. Fetch the news center page with browser-like User-Agent
//   2. Parse HTML, extract all <a> tags with non-empty text
//   3. Filter to internal links (href starts with / or with same host)
//   4. Return normalized {title, url} pairs
//
// China-friendly: uses simple fetch + HTML parsing, no JS, no external APIs.

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { fetchGoogleNewsRss, resolveGoogleNewsUrls } from './google-news.mjs';
import { fetchEefocusNews } from './eefocus-news.mjs';
import { fetchBingNews } from './bing-news.mjs';
import { fetchMetaSummary, extractDateFromTitle } from './html-helpers.mjs';

const FILE_URL_RE = /\.(pdf|docx?|xlsx?|zip|rar|jpg|jpeg|png|gif|webp|svg)$/i;

function isFileUrl(url) {
  return FILE_URL_RE.test(url || '');
}

// Fetch meta summaries for a list of HTML pages (skips files, runs in parallel).
// Three-stage strategy:
//   Stage 1: regular fetch (fast, ~1-2s per item)
//   Stage 2: Playwright browser fallback for blocked/paywall sites (403/401)
//   Stage 3: DuckDuckGo HTML search to find a mirror URL on a non-blocked
//            domain (e.g. yahoo article mirrored on reuters / yahoo via DDG)
async function fillSnippets(scraped) {
  const htmlItems = scraped.filter(s => !isFileUrl(s.url));

  // Stage 1: regular fetch (fast)
  await Promise.all(htmlItems.map(async item => {
    const summary = await fetchMetaSummary(item.url);
    if (summary) item.snippet = summary;
  }));

  // Stage 2 + 3: handle items still missing snippet
  const needsMore = scraped.filter(s => !isFileUrl(s.url) && (!s.snippet || s.snippet.length === 0));
  if (needsMore.length === 0) return;

  // Known bot-blocked domains (always 403 to non-browser fetches)
  const BLOCKED_DOMAINS = [
    'finance.yahoo.com', 'aol.com', 'reuters.com', 'barrons.com',
    'nasdaq.com', 'onmsft.com', 'venturebeat.com', '247wallst.com',
    'pr.tsmc.com', 'investor.tsmc.com', 'bydglobal.com', 'solvay.com',
  ];
  const isBlocked = (url) => {
    try { return BLOCKED_DOMAINS.some(d => new URL(url).hostname.includes(d)); }
    catch { return false; }
  };

  // Stage 2: Playwright browser fetch
  await tryPlaywrightSnippets(needsMore);

  // Stage 3: For items still empty AND on blocked domains, search DuckDuckGo
  // for a mirror of the same article (e.g. Yahoo Finance article reprinted
  // on Reuters or Nasdaq).
  const stillEmpty = needsMore.filter(s => !s.snippet && isBlocked(s.url));
  await tryMirrorSnippets(stillEmpty);
}

// Stage 2: Playwright headless browser extraction
async function tryPlaywrightSnippets(items) {
  if (items.length === 0) return;
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    const PARALLEL = 3;
    for (let i = 0; i < items.length; i += PARALLEL) {
      const batch = items.slice(i, i + PARALLEL);
      await Promise.all(batch.map(async item => {
        let page;
        try {
          page = await ctx.newPage();
          try {
            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          } catch {
            // Page may still have rendered something even if goto timed out
          }
          await page.waitForTimeout(800);
          const snippet = await page.evaluate(() => {
            const m1 = document.querySelector('meta[name="description"]');
            if (m1 && m1.content && m1.content.length > 30) return m1.content.trim();
            const m2 = document.querySelector('meta[property="og:description"]');
            if (m2 && m2.content && m2.content.length > 30) return m2.content.trim();
            const m3 = document.querySelector('meta[name="twitter:description"]');
            if (m3 && m3.content && m3.content.length > 30) return m3.content.trim();
            const scope = document.querySelector('article') || document.querySelector('main') || document.body;
            if (!scope) return '';
            for (const p of scope.querySelectorAll('p')) {
              const text = (p.textContent || '').trim().replace(/\s+/g, ' ');
              if (text.length >= 60 && !/cookie|consent|subscribe|sign up|privacy/i.test(text)) {
                return text.slice(0, 240) + (text.length > 240 ? '…' : '');
              }
            }
            return '';
          });
          if (snippet && snippet.length >= 30) item.snippet = snippet;
        } catch {
          // skip
        } finally {
          if (page) try { await page.close(); } catch {}
        }
      }));
    }
  } catch {
    // Playwright unavailable
  } finally {
    if (browser) try { await browser.close(); } catch {}
  }
}

// Stage 3: DuckDuckGo search to find a mirror article, then fetch its snippet
async function tryMirrorSnippets(items) {
  if (items.length === 0) return;
  // Use a process-wide concurrency of 2 to keep it gentle
  for (const item of items) {
    try {
      const title = item.title.replace(/[^\w\s一-鿿]/g, ' ').slice(0, 80);
      // Search DuckDuckGo HTML (bot-friendly, no captcha)
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(title + ' news')}`;
      const r = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const html = await r.text();
      // Find first result that is NOT the blocked domain
      const anchorRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      while ((m = anchorRegex.exec(html)) !== null) {
        const href = decodeURIComponent(m[1].replace(/&amp;/g, '&'));
        let mirrorHost = '';
        try { mirrorHost = new URL(href).hostname; } catch {}
        if (mirrorHost && !['finance.yahoo.com', 'aol.com', 'reuters.com', 'barrons.com', 'nasdaq.com', 'duckduckgo.com'].some(d => mirrorHost.includes(d))) {
          // Try to fetch snippet from mirror
          const summary = await fetchMetaSummary(href);
          if (summary && summary.length >= 30) {
            item.snippet = summary;
            break;
          }
        }
      }
    } catch {
      // skip this item
    }
  }
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FETCH_TIMEOUT = 12000;
const MAX_ARTICLES = 40;

// Block paths that are clearly not individual articles
const NON_ARTICLE_PATTERNS = [
  /\/(about|contact|privacy|terms|legal|cookies?|sitemap|search|category|tag|login|register|signup|signin|subscribe|subscription|alert|newsletter)/i,
  /\.(jpg|jpeg|png|gif|webp|svg|zip|rar|docx?|xlsx?)$/i,
  /#$/,
  /^mailto:/i,
  /^javascript:/i,
  /^#(?![\w-])/,  // bare anchors (allow article slugs)
  /\/(index|home|main|default|list|all)\.(html?|php|aspx?)$/i,
  /^\?year=\d{4}$/,  // year filter selectors like ?year=2026
  /^\?[a-z]+=\d{4}$/i,  // other year/numeric-only query selectors
  /^(index|home|main|default|list)\.(html?|php|aspx?)?(\?.*)?$/i,  // default landing pages
  /\/page\/\d+/i,  // pagination like /page/2
  /\/tag\/[^/]+\/?$/i,  // tag listing pages
  /\/category\/[^/]+\/?$/i,
  /\/developer\/[^/]*\/(join|programs?|register)/i,  // dev portal CTAs (e.g. /developer.nvidia.com/join)
  /\/developer-program/i,
  /\/products?\/(index|list|catalog)/i,  // product catalog landing pages
  /\/products?\//i,  // any product page (e.g. Empyrean /products/eda/flat-panel-display.html)
  /\/solution[s]?\/index/i,  // "Complete Solution for ..." product pages
  /\/video\//i,  // video-only pages (often JS-embedded players, low info value)
  /\/(annual|financial)-reports?$/i,  // direct report downloads, not news
  /\/press-release(\.html)?$/i,  // bare /press-release listing pages
  /\/ir\/library\//i,  // IR library index pages (e.g. Teijin /ir/library/presentation-materials/)
  /\/library\//i,  // generic library indexes
  /\/event\/[^/]+\/?$/i,  // event info pages (TSMC /event/biodiversityaward, etc.)
  /\/events?\/?$/i,
  /#page_/i,  // anchor-tab navigation (e.g. SMIC #page_slide_0)
  /[#&]page=\d+/i,
  /[#&]slide=\d+/i,
  /\/webcast|\/replay|\/conference-call/i,  // earnings call replays
  /\/(presentations?|webcasts?|replays?)\/?$/i,
];

// Block URLs hosted on these off-domain services (not the company's own news)
const OFF_DOMAIN_BLOCKLIST = [
  /files\.microcms-assets\.io/i,  // 3rd-party CMS CDN, often cited but off-domain
  /edge\.media-server\.com/i,      // Q4 webcast player (earnings call replays)
  /finance\.yahoo\.com/i,          // Yahoo Finance video embeds
  /bloomberg\.com/i,               // Bloomberg video pages
  /youtube\.com|youtu\.be/i,       // YouTube embeds (often blocked in CN)
  /vimeo\.com/i,
];

// Block title patterns that look like nav/UI
const NON_ARTICLE_TITLE_PATTERNS = [
  /^(home|back|next|prev|read more|view all|see all|more|load more|show more)$/i,
  /^\s*[\d•·|→←]+\s*$/,  // just numbers or bullets
  /^\s*$/,
  /^(about|contact|login|register|sign in|sign up|subscribe|follow|share|download|menu|search|close|open)$/i,
  /^\d{4}$/,  // bare year like "2026"
  /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/,  // bare date
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{0,2}$/i,  // bare month
  /^(home|首页|返回|更多|查看|next|prev|上页|下页|更多|登录|注册)$/i,  // CN nav
  /^[^-—\n]{1,40}\s*[-—]\s*[^-—\n]{1,40}$/,  // "X - Y" short pattern (often nav like "About - Company")
  /^(首页|业务|产品|技术|应用|服务|关于|加入|联系|帮助|帮助中心|投资者|公司|企业|管理|团队|里程碑|文化|资质|证书)/,  // CN nav single words
  // CTAs / UI elements accidentally scraped as headlines
  /^(sign up for|join the|subscribe to|read our|view our|click here|learn more|find out more|get (the )?latest|see (the )?latest|discover more|explore more)/i,
  /^(quarterly earnings|interim \/ annual report|annual report|earnings call|financial report|financial summary|investor relations|press releases?)$/i,
];

// Require at least one news signal: a date (year 20XX) or a news action verb
const NEWS_INDICATORS = [
  /\b(19|20)\d{2}\b/,        // any year 1900-2099 (covers 2025, 2026, 2027, etc.)
  /\b二零[一二三四五六七八九〇]+\b/,  // Chinese year notation like 二零二六
  /\b第[一二三四五]?[一二三四五六七八九十百\d]+季\b/,  // 第X季 (quarterly)
  /\bQ[1-4]\b/i,            // Q1, Q2, etc.
  /发布|推出|签署|完成|收购|合作|投资|启动|扩张|宣布|突破|增长|减少|投产|下线|上线|任命|成为|获得|推出|正式|公布|宣布|透露|披露|报道|推出|拓展|达成|战略|协议/,  // CN news verbs
  /\b(launch|announce|partner|invest|acquire|complete|start|sign|introduce|release|report|reveal|expand|unveil|appoint|raise|achieve|win|secure|develop|complete|ship|deliver|join|leave|merge|acquire)\b/i,
  /\b(report|earnings|revenue|profit|partnership|deal|launches?|shipments?|orders?|results?|presentation|forecast|fiscal|consolidated|certif|award|develops?|developing|selected|adopts?|recogni[sz]ed|joins?|strengthens?|highlights?|showcases?|unveils?)\b/i,
];

// Years considered too old for "latest news". Adjust cutoff as time advances.
const STALE_YEAR_REGEX = /\b(19\d{2}|20[0-2]\d)\b/g;  // matches any year; we'll filter by comparison
function extractYear(text) {
  if (!text) return null;
  const m = text.match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}
function isStale(text, currentYear) {
  const y = extractYear(text);
  return y !== null && y < currentYear - 2;  // older than 2 years is stale
}

function isArticleUrl(href) {
  if (!href) return false;
  if (href.startsWith('#') && href.length < 3) return false;
  for (const re of NON_ARTICLE_PATTERNS) if (re.test(href)) return false;
  for (const re of OFF_DOMAIN_BLOCKLIST) if (re.test(href)) return false;
  return true;
}

// Heuristic: a real article title has substantive content + at least one news
// signal (date, action verb, or report keyword). Nav/UI items are short and
// lack news signals.
function isArticleTitle(text, currentYear = new Date().getFullYear()) {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 10 || t.length > 300) return false;
  for (const re of NON_ARTICLE_TITLE_PATTERNS) if (re.test(t)) return false;
  // Must have at least one news indicator (date, year, or news verb)
  const hasNewsSignal = NEWS_INDICATORS.some(re => re.test(t));
  if (!hasNewsSignal) return false;
  // Drop stale news (older than 2 years from current year)
  if (isStale(t, currentYear)) return false;
  return true;
}

function normalizeUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function jaccardSimilarity(a, b) {
  // Tokenize on whitespace + lowercase
  const tokA = new Set(a.toLowerCase().split(/\W+/).filter(t => t.length >= 2));
  const tokB = new Set(b.toLowerCase().split(/\W+/).filter(t => t.length >= 2));
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let inter = 0;
  for (const t of tokA) if (tokB.has(t)) inter++;
  return inter / (tokA.size + tokB.size - inter);
}

/**
 * Fetch a news center page and extract article links.
 * Returns array of {title, url} sorted by document order (newest first usually).
 */
export async function scrapeNewsCenter(newsCenterUrl, { fetchImpl = globalThis.fetch, maxArticles = MAX_ARTICLES, timeout = FETCH_TIMEOUT } = {}) {
  if (!newsCenterUrl) return [];
  let html;
  try {
    const res = await fetchImpl(newsCenterUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      },
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  let dom;
  try {
    dom = new JSDOM(html, { url: newsCenterUrl });
  } catch {
    return [];
  }

  const doc = dom.window.document;

  // Position-based: only consider links inside content areas, not nav/header/footer.
  // If <main> or <article> exists, use it. Otherwise use the body.
  const root = doc.querySelector('main, article, [role="main"]') || doc.body;

  // Walk all anchors within the content root, excluding those inside nav/header/footer.
  const anchors = root.querySelectorAll('a[href]');
  const seen = new Set();
  const articles = [];
  for (const a of anchors) {
    // Skip anchors inside nav/header/footer/aside
    if (a.closest('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"]')) continue;
    const href = a.getAttribute('href');
    if (!isArticleUrl(href)) continue;
    const abs = normalizeUrl(href, newsCenterUrl);
    if (!abs) continue;
    if (seen.has(abs)) continue;
    const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
    if (!isArticleTitle(text)) continue;
    seen.add(abs);
    articles.push({ title: text, url: abs });
    if (articles.length >= maxArticles) break;
  }

  return articles;
}

/**
 * Match RSS items to scraped article URLs by title similarity.
 * Returns a new array of items with `url` replaced where matched.
 */
export function matchItemsToArticles(rssItems, scrapedArticles, { threshold = 0.3 } = {}) {
  if (scrapedArticles.length === 0) return rssItems;
  return rssItems.map(item => {
    let best = null;
    let bestScore = 0;
    for (const art of scrapedArticles) {
      const score = jaccardSimilarity(item.title, art.title);
      if (score > bestScore) {
        bestScore = score;
        best = art;
      }
    }
    if (best && bestScore >= threshold) {
      return { ...item, url: best.url, _matchScore: bestScore };
    }
    return item;
  });
}

/**
 * DuckDuckGo HTML search fallback. Use when direct news-center scraping fails
 * or returns too few results. China-friendly (no JS, no API key).
 *
 * Returns array of {title, url} of search hits.
 */
export async function searchArticleViaDDG(title, siteDomain, { fetchImpl = globalThis.fetch, maxResults = 5, timeout = 8000 } = {}) {
  if (!title || !siteDomain) return [];
  const query = `${title} site:${siteDomain}`;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  let html;
  try {
    const res = await fetchImpl(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  let dom;
  try {
    dom = new JSDOM(html);
  } catch {
    return [];
  }

  const results = [];
  // DDG HTML layout: results are in .result__a links, with .result__snippet for description
  const links = dom.window.document.querySelectorAll('a.result__a, .result a');
  for (const a of links) {
    const href = a.getAttribute('href');
    if (!href) continue;
    const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 10) continue;
    // DDG HTML uses redirect URLs like //duckduckgo.com/l/?uddg=... — skip these
    if (href.includes('duckduckgo.com/l/') || href.includes('duck.co/l/')) continue;
    results.push({ title: text, url: href });
    if (results.length >= maxResults) break;
  }
  return results;
}

/**
 * Playwright-based scrape: launches a real headless browser, navigates to the
 * news center, and extracts article links. Used as a fallback when simple
 * fetch-based scraping returns too few results (JS-rendered sites).
 */
export async function scrapeNewsCenterWithPlaywright(newsCenterUrl, { maxArticles = MAX_ARTICLES, timeout = 30000 } = {}) {
  if (!newsCenterUrl) return [];
  // Use longer timeouts and 'commit' wait — many CN sites (e.g. bosomchina.com)
  // are slow / JS-heavy and never reach domcontentloaded within 30s.
  const effectiveTimeout = Math.max(timeout, 60000);
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      userAgent: BROWSER_UA,
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    try {
      // domcontentloaded is more reliable than commit (which fails on some
      // HTTP/2 sites like bosomchina.com with ERR_HTTP2_PROTOCOL_ERROR).
      await page.goto(newsCenterUrl, { waitUntil: 'domcontentloaded', timeout: effectiveTimeout });
    } catch (e) {
      // domcontentloaded timed out — try with 'load' which is more lenient
      console.warn(`[playwright] domcontentloaded timeout for ${newsCenterUrl}, retrying...`);
      try { await page.goto(newsCenterUrl, { waitUntil: 'load', timeout: effectiveTimeout }); }
      catch { /* even load timed out, but the page may have rendered something */ }
    }
    // Give the page time to fully render. Slow CN sites (e.g. bosomchina.com)
    // need up to 8s after first byte to render article lists.
    await page.waitForTimeout(8000);
    const anchors = await page.$$('a[href]');
    const seen = new Set();
    const articles = [];
    for (const a of anchors) {
      const data = await a.evaluate(el => {
        let n = el;
        while (n && n !== document.body) {
          const tag = n.tagName?.toLowerCase();
          if (tag === 'nav' || tag === 'header' || tag === 'footer' || tag === 'aside') return null;
          if (n.getAttribute('role') === 'navigation' || n.getAttribute('role') === 'banner' || n.getAttribute('role') === 'contentinfo') return null;
          n = n.parentElement;
        }
        return {
          href: el.getAttribute('href'),
          text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        };
      });
      if (!data || !data.href) continue;
      if (!isArticleUrl(data.href)) continue;
      if (!isArticleTitle(data.text)) continue;
      const abs = normalizeUrl(data.href, newsCenterUrl);
      if (!abs || seen.has(abs)) continue;
      seen.add(abs);
      articles.push({ title: data.text, url: abs });
      if (articles.length >= maxArticles) break;
    }
    return articles;
  } catch (err) {
    return [];
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}

/**
 * Build a list of news items for a company:
 *   1. Try scraping the news center (simple fetch)
 *   2. Fall back to Playwright if simple fetch returns 0
 *   3. If no scraped data, return raw RSS items with news center URL
 *
 * Each returned item has title + url that always correspond (title from scraped
 * article is paired with that article's url; for RSS items without scraped
 * matches, news center URL is used as fallback).
 */
export async function buildNewsItems(rssItems, companyName, newsUrl, perCompany = 10, opts = {}) {
  const siteDomain = opts.siteDomain || null;
  if (!newsUrl) return rssItems.slice(0, perCompany);

  // Threshold: if simple fetch returns at least this many, skip Playwright.
  // Below this, also try Playwright to fill out the list.
  const PLAYWRIGHT_THRESHOLD = 5;

  let scraped = [];
  try { scraped = await scrapeNewsCenter(newsUrl, { maxArticles: 30 }); } catch {}
  if (scraped.length < PLAYWRIGHT_THRESHOLD) {
    try { scraped = scraped.concat(await scrapeNewsCenterWithPlaywright(newsUrl, { maxArticles: 30 })); } catch {}
    // Retry once on transient failure (Playwright flakes occasionally)
    if (scraped.length < PLAYWRIGHT_THRESHOLD) {
      await new Promise(r => setTimeout(r, 1500));
      try { scraped = scraped.concat(await scrapeNewsCenterWithPlaywright(newsUrl, { maxArticles: 30 })); } catch {}
    }
  }

  // If we have fewer than perCompany articles, supplement with Bing News + EEFocus.
// We always try these (not just when scraping fails) to fill out the list
// for companies whose news centers don't return enough.
if (scraped.length < perCompany) {
    try {
      const enMatch = companyName.match(/[A-Za-z][A-Za-z0-9-]+/);
      const enQuery = enMatch ? enMatch[0] : null;
      const candidates = [enQuery, companyName].filter(Boolean);
      const currentYear = new Date().getFullYear();
      const RECENT_YEAR_FLOOR = currentYear - 2;  // drop items older than 2 years

      // Filter out obvious wrong-company matches (e.g. "Ben Song" actor,
      // "Bosom Buddies" TV show, "decline of the bosom" articles). For
      // Chinese companies, we check the URL domain — only allow items on
      // the company's actual domain OR a CN news site that mentions the
      // company by its full Chinese name.
      const isWrongCompany = (title, url) => {
        const t = title.toLowerCase();
        // Detect people named Bensong / Ben Song (actor, person) vs the company
        if (/ben song\b.*(shares|secret|actor|star|trailer|quantum leap)/i.test(title)) return true;
        if (/(shares his|her|their) secret/i.test(title)) return true;
        if (/actor|actress|celebrity|musician|singer/i.test(title)) return true;
        // "Bosom Buddies" TV show, "decline of the bosom" articles, beauty articles
        if (/bosom budd(ies|y)/i.test(title)) return true;
        if (/decline of the bosom/i.test(title)) return true;
        if (/grow your bosom|grow.*bosom/i.test(title)) return true;
        if (/bosom button/i.test(title)) return true;
        if (/a bosom friend/i.test(title)) return true;
        if (/\bbosom\b/i.test(title) && !/本松|bosomchina|新材料|hangzhou/i.test(title)) return true;
        // For CN companies, only accept results from CN domains or domains
        // that mention the company in URL (filters out english entertainment news)
        try {
          const u = new URL(url);
          const host = u.hostname.toLowerCase();
          const isForeignHost = !host.endsWith('.cn') && !host.includes('bosomchina.com') &&
            !host.includes('caixin') && !host.includes('scmp') && !host.includes('yicai') &&
            !host.includes('chinadaily') && !host.includes('globaltimes') && !host.includes('sina');
          if (isForeignHost && !siteDomain) return true;  // for English companies, accept any
        } catch {}
        return false;
      };

      for (const q of candidates) {
        const bing = await fetchBingNews(q, { maxResults: 30 });
        if (bing.length > 0) {
          const filtered = bing
            .filter(it => !isWrongCompany(it.title, it.url))
            .filter(it => {
              const m = it.title.match(/\b(20\d{2})\b/);
              return !m || parseInt(m[1]) >= RECENT_YEAR_FLOOR;
            });
          scraped = scraped.concat(filtered.map(it => ({ title: it.title, url: it.url })));
          break;
        }
      }
    } catch {}

    // EEFocus supplement: for CN companies (or sparse results), try EEFocus
    // which has good CN industry coverage.
    if (scraped.length < perCompany) {
      try {
        const eefocus = await fetchEefocusNews(companyName, { maxResults: 30 });
        if (eefocus.length > 0) {
          const enMatch = companyName.match(/[A-Za-z][A-Za-z0-9-]+/);
          const cnName = companyName.replace(/[A-Za-z][A-Za-z0-9-]+/g, '').trim().split(/\s+/)[0];
          const filtered = cnName.length >= 2
            ? eefocus.filter(it => it.title.includes(cnName) || it.title.toLowerCase().includes((enMatch?.[0]||'').toLowerCase()))
            : eefocus;
          scraped = scraped.concat(filtered.map(it => ({ title: it.title, url: it.url })));
        }
      } catch {}
    }
  }

  // If still empty after Bing + EEFocus supplement, try Google News RSS
  if (scraped.length === 0) {
    try {
      const rss = await fetchGoogleNewsRss(companyName, siteDomain || '', { maxResults: 30 });
      if (rss.length > 0) {
        const resolved = await resolveGoogleNewsUrls(rss, { concurrency: 4 });
        scraped = resolved
          .filter(it => it.url && !it.url.includes('news.google.com'))
          .map(it => ({ title: it.title, url: it.url }));
      }
    } catch {}
  }

  if (scraped.length === 0) {
    // Last resort: use manually-curated fallback_news from industries.json
    // if provided. Useful for companies whose news center can't be scraped
    // (HTTP/2 issues, bot-protected) or whose news isn't indexed by aggregators.
    if (opts.fallbackNews && Array.isArray(opts.fallbackNews) && opts.fallbackNews.length > 0) {
      return opts.fallbackNews.slice(0, perCompany).map(n => ({
        title: n.title,
        url: n.url,
        snippet: '',
      }));
    }
    // No scraped articles and no fallback: return ONE generic item pointing to news center.
    return [{
      title: `查看 ${companyName} 新闻中心`,
      url: newsUrl,
      snippet: '',
    }];
  }

  // Use ONLY scraped articles. Each item's title and url always match.
  // Dedupe by full URL — query params like ?id=NNNN are meaningful for SPA-style
  // news-detail pages (different articles share the same path). Only strip
  // pure tracking params (?utm_*, ?padid=).
  const itemsToShow = [];
  const seenUrls = new Set();
  const TRACKING_PARAM = /^(utm_|padid|fbclid|gclid|mc_[a-z]+|icid|_ga)/i;
  const normalizeUrl = u => {
    try {
      const x = new URL(u);
      const params = [...x.searchParams.entries()].filter(([k]) => !TRACKING_PARAM.test(k));
      params.sort(([a],[b]) => a.localeCompare(b));
      const qs = params.map(([k,v]) => `${k}=${v}`).join('&');
      return x.origin + x.pathname + (qs ? '?' + qs : '');
    } catch { return u; }
  };
  for (let idx = 0; idx < scraped.length && itemsToShow.length < perCompany; idx++) {
    const scrapedArt = scraped[idx];
    if (!scrapedArt || !scrapedArt.url) continue;
    const norm = normalizeUrl(scrapedArt.url);
    if (seenUrls.has(norm)) continue;
    seenUrls.add(norm);
    const rssItem = rssItems[idx];
    let snippet = '';
    if (rssItem) {
      const matches = matchItemsToArticles([rssItem], [scrapedArt]);
      if (matches[0]._matchScore && matches[0]._matchScore >= 0.3 && matches[0].url === scrapedArt.url) {
        snippet = rssItem.snippet || '';
      }
    }
    itemsToShow.push({
      title: scrapedArt.title,
      url: scrapedArt.url,
      snippet,
      // Extract publication date from title when not provided
      published_at: extractDateFromTitle(scrapedArt.title) || null,
      source: (() => { try { return new URL(scrapedArt.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
    });
  }

  // Fetch meta description summaries for HTML pages (skips files automatically).
  // Files (PDFs etc.) keep empty snippet — they'll just show the title in the UI.
  await fillSnippets(itemsToShow);
  return itemsToShow;
}
