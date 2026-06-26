// Bing News fetcher. Bing News works from this sandbox via proxy and returns
// real article URLs (not redirect URLs). The English version (setlang=en) gives
// the broadest results for both Chinese and English company names.
//
// Bing is generally accessible globally. CN users can also access via cn.bing.com.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

import { JSDOM } from 'jsdom';

const NO_RESULT_MARKER = 'newsserp.noresult';

/**
 * Search Bing News for [query] and return list of {title, url, source} pairs.
 * Uses English locale by default — returns broader results than Chinese locale
 * for mixed-language company names.
 */
export async function fetchBingNews(query, {
  fetchImpl = globalThis.fetch,
  timeout = 12000,
  maxResults = 10,
  baseUrl = 'https://www.bing.com',
  setlang = 'en',
} = {}) {
  if (!query) return [];
  const url = `${baseUrl}/news/search?q=${encodeURIComponent(query)}&setlang=${setlang}&cc=us`;
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

  // Bail if Bing returned a "no results" page
  if (html.includes(NO_RESULT_MARKER)) return [];

  let dom;
  try { dom = new JSDOM(html); } catch { return []; }
  const doc = dom.window.document;

  // Bing News articles: anchors with substantial text whose href is external.
  // The card layout varies, so we use a broad anchor scan filtered by URL.
  const anchors = [...doc.querySelectorAll('a[href^="http"]')];
  const items = [];
  const seen = new Set();
  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    // Skip Bing internal links, Microsoft, Google, etc.
    if (!href || href.includes('bing.com') || href.includes('microsoft.com')
        || href.includes('msn.com') || href.includes('go.microsoft.com')) continue;
    const title = (a.textContent || '').trim().replace(/\s+/g, ' ');
    if (title.length < 20 || title.length > 200) continue;
    // Filter out nav/UI items: must contain a space (real headlines have multiple words)
    if (!title.includes(' ')) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    let source = 'unknown';
    try { source = new URL(href).hostname.replace(/^www\./, ''); } catch {}

    items.push({ title, url: href, source });
    if (items.length >= maxResults) break;
  }
  return items;
}