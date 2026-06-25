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

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FETCH_TIMEOUT = 12000;
const MAX_ARTICLES = 40;

// Block paths that are clearly not individual articles
const NON_ARTICLE_PATTERNS = [
  /\/(about|contact|privacy|terms|legal|cookies?|sitemap|search|category|tag|login|register|signup|signin)/i,
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
];

// Require at least one news signal: a date (year 20XX) or a news action verb
const NEWS_INDICATORS = [
  /\b(19|20)\d{2}\b/,        // any year 1900-2099 (covers 2025, 2026, 2027, etc.)
  /\b二零[一二三四五六七八九〇]+\b/,  // Chinese year notation like 二零二六
  /\b第[一二三四五]?[一二三四五六七八九十百\d]+季\b/,  // 第X季 (quarterly)
  /\bQ[1-4]\b/i,            // Q1, Q2, etc.
  /发布|推出|签署|完成|收购|合作|投资|启动|扩张|宣布|突破|增长|减少|投产|下线|上线|任命|成为|获得|推出|正式|公布|宣布|透露|披露|报道|推出|拓展|达成|战略|协议/,  // CN news verbs
  /\b(launch|announce|partner|invest|acquire|complete|start|sign|introduce|release|report|reveal|expand|unveil|appoint|raise|achieve|win|secure|develop|complete|ship|deliver|join|leave|merge|acquire)\b/i,
  /\b(report|earnings|revenue|profit|partnership|deal|launches?|shipments?|orders?)\b/i,
];

function isArticleUrl(href) {
  if (!href) return false;
  if (href.startsWith('#') && href.length < 3) return false;
  for (const re of NON_ARTICLE_PATTERNS) if (re.test(href)) return false;
  return true;
}

// Heuristic: a real article title has substantive content + at least one news
// signal (date, action verb, or report keyword). Nav/UI items are short and
// lack news signals.
function isArticleTitle(text) {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 10 || t.length > 300) return false;
  for (const re of NON_ARTICLE_TITLE_PATTERNS) if (re.test(t)) return false;
  // Must have at least one news indicator (date, year, or news verb)
  const hasNewsSignal = NEWS_INDICATORS.some(re => re.test(t));
  if (!hasNewsSignal) return false;
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
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      userAgent: BROWSER_UA,
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    await page.goto(newsCenterUrl, { waitUntil: 'domcontentloaded', timeout });
    // Give the page a moment for JS to render
    await page.waitForTimeout(2000);
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
export async function buildNewsItems(rssItems, companyName, newsUrl, perCompany = 10) {
  if (!newsUrl) return rssItems.slice(0, perCompany);

  let scraped = [];
  try { scraped = await scrapeNewsCenter(newsUrl, { maxArticles: 30 }); } catch {}
  if (scraped.length === 0) {
    try { scraped = await scrapeNewsCenterWithPlaywright(newsUrl, { maxArticles: 30 }); } catch {}
  }

  if (scraped.length === 0) {
    // No scraped articles: return ONE generic item pointing to news center.
    // Title matches the URL destination (both = "Visit [Company] news center").
    return [{
      title: `查看 ${companyName} 新闻中心`,
      url: newsUrl,
      snippet: '',
    }];
  }

  // Use ONLY scraped articles. Each item's title and url always match.
  const itemsToShow = [];
  for (let idx = 0; idx < perCompany; idx++) {
    const scrapedArt = scraped[idx];
    if (!scrapedArt) break;
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
    });
  }
  return itemsToShow;
}
