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
];

function isArticleUrl(href) {
  if (!href) return false;
  if (href.startsWith('#') && href.length < 3) return false;
  for (const re of NON_ARTICLE_PATTERNS) if (re.test(href)) return false;
  return true;
}

// Heuristic: a real article title is usually 10+ chars with substantive content.
// Bare 2-3 char words like "首页", "产品", "关于" are nav items.
function isArticleTitle(text) {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 10 || t.length > 300) return false;
  for (const re of NON_ARTICLE_TITLE_PATTERNS) if (re.test(t)) return false;
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
 * Resolve a single RSS item to a real article URL.
 * Tries: (1) direct news-center scrape + match, (2) DDG site-search.
 * Falls back to newsCenterUrl if both fail.
 */
export async function resolveArticleUrl(rssItem, companyName, newsCenterUrl, opts = {}) {
  const { fetchImpl, logger = () => {} } = opts;

  // 1. Try scraping news center
  if (newsCenterUrl) {
    const scraped = await scrapeNewsCenter(newsCenterUrl, { fetchImpl });
    if (scraped.length > 0) {
      const matches = matchItemsToArticles([rssItem], scraped);
      if (matches[0].url && matches[0]._matchScore && matches[0]._matchScore >= 0.3) {
        return { url: matches[0].url, source: 'scraped', score: matches[0]._matchScore };
      }
    }
  }

  // 2. Try DDG site-search
  if (newsCenterUrl) {
    try {
      const base = new URL(newsCenterUrl);
      const results = await searchArticleViaDDG(rssItem.title, base.hostname.replace(/^www\./, ''), { fetchImpl });
      if (results.length > 0) {
        return { url: results[0].url, source: 'ddg', title: results[0].title };
      }
    } catch {}
  }

  // 3. Fall back to news center URL
  return { url: newsCenterUrl, source: 'fallback' };
}
