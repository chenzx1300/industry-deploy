// EEFocus (与非网) news fetcher. EEFocus is a major Chinese electronics industry
// news site, indexed well in Baidu and accessible in mainland China without VPN.
//
// Strategy:
//   1. Search eefocus for [company keywords]
//   2. Parse the result page to extract {title, articleUrl} pairs
//   3. Return as {title, url, source: 'eefocus.com', published_at: null}
//
// CN-friendly: eefocus.com is hosted in China, accessible without VPN.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

import { JSDOM } from 'jsdom';

/**
 * Search eefocus.com for [query] and return list of {title, url} pairs.
 * Article URLs follow /article/{id}.html pattern.
 */
export async function searchEefocus(query, {
  fetchImpl = globalThis.fetch,
  timeout = 12000,
  maxResults = 10,
  baseUrl = 'https://www.eefocus.com',
} = {}) {
  if (!query) return [];
  const url = `${baseUrl}/search/?q=${encodeURIComponent(query)}`;
  let html;
  try {
    const res = await fetchImpl(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  let dom;
  try { dom = new JSDOM(html); } catch { return []; }
  const doc = dom.window.document;

  const items = [];
  // EEFocus article links: /article/{id}.html — clean pattern, no tracking params
  const anchors = [...doc.querySelectorAll('a[href*="/article/"]')];
  for (const a of anchors) {
    const href = a.getAttribute('href');
    if (!href || !/\/article\/\d+\.html/.test(href)) continue;
    const title = (a.textContent || '').trim().replace(/\s+/g, ' ');
    if (title.length >= 12 && title.length < 200) {
      const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
      // Avoid dupes
      if (items.find(it => it.url === fullUrl)) continue;
      items.push({ title, url: fullUrl });
      if (items.length >= maxResults) break;
    }
  }
  return items;
}

/**
 * One-shot fetch: search eefocus and return array of news items.
 */
export async function fetchEefocusNews(query, opts = {}) {
  const items = await searchEefocus(query, opts);
  return items.map(it => ({
    title: it.title,
    url: it.url,
    source: 'eefocus.com',
    published_at: null,
  }));
}