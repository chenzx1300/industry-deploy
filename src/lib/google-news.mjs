// Google News RSS fetcher. Generates RSS search URLs for a company (with site: filter
// restricted to the company's domain), parses the results, and (best-effort) tries to
// resolve Google News redirect URLs to the actual publisher article URL.
//
// Important caveat: Google News URLs are blocked in mainland China. We try to resolve
// them to publisher URLs (which are usually accessible) when possible. When that fails,
// we use the publisher's domain as a fallback "source link" so the user at least sees
// who published the article (the title is still useful as a pointer).

import { parseGoogleNewsRss } from './rss-parser.mjs';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Build a Google News RSS search URL for a company.
 * Uses site: operator to restrict to the company's domain.
 * Language is auto-detected by Google based on the company name.
 */
export function googleNewsRssUrl(companyName, siteDomain, { hl = 'zh-CN', gl = 'CN', ceid = 'CN:zh-Hans' } = {}) {
  // Build the query: prefer site:-restricted search so we get only news from that company
  const query = siteDomain
    ? `${companyName} site:${siteDomain}`
    : companyName;
  const params = new URLSearchParams({
    q: query,
    hl, gl, ceid,
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

/**
 * Fetch Google News RSS for a company and parse it. Returns the same items as
 * parseGoogleNewsRss (title, snippet, url, source, published_at, direct_url).
 *
 * The returned `url` is the Google News redirect URL (will be blocked in CN).
 * The `direct_url` is the publisher's homepage, not the actual article.
 * Use `resolveGoogleNewsUrl()` to try to get the real article URL.
 */
export async function fetchGoogleNewsRss(companyName, siteDomain, {
  fetchImpl = globalThis.fetch,
  timeout = 10000,
  maxResults = 20,
} = {}) {
  const url = googleNewsRssUrl(companyName, siteDomain);
  let xml;
  try {
    const res = await fetchImpl(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return [];
    xml = await res.text();
  } catch {
    return [];
  }
  const items = parseGoogleNewsRss(xml).slice(0, maxResults);
  return items;
}

/**
 * Try to resolve a Google News redirect URL to the actual publisher article URL.
 * Returns the resolved URL string, or null if resolution fails.
 *
 * Google News URLs look like:
 *   https://news.google.com/rss/articles/CBMi...base64...
 * When fetched, they 302-redirect to the publisher's article page.
 *
 * Some Google News URLs use a tracking pixel pattern instead — those resolve to
 * news.google.com itself. We detect and skip those.
 */
export async function resolveGoogleNewsUrl(googleNewsUrl, {
  fetchImpl = globalThis.fetch,
  timeout = 8000,
} = {}) {
  if (!googleNewsUrl || !googleNewsUrl.includes('news.google.com')) return null;
  try {
    const res = await fetchImpl(googleNewsUrl, {
      method: 'HEAD',  // lighter than GET
      redirect: 'follow',
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(timeout),
    });
    const finalUrl = res.url;
    if (!finalUrl || finalUrl.includes('news.google.com')) return null;
    return finalUrl;
  } catch {
    return null;
  }
}

/**
 * Resolve a batch of Google News items to actual publisher URLs in parallel.
 * Returns items with `url` replaced by the resolved URL when successful.
 * Items that fail to resolve keep their original Google News URL.
 */
export async function resolveGoogleNewsUrls(items, { concurrency = 6 } = {}) {
  const results = [...items];
  for (let i = 0; i < results.length; i += concurrency) {
    const batch = results.slice(i, i + concurrency);
    await Promise.all(batch.map(async (item, j) => {
      if (!item.url || !item.url.includes('news.google.com')) return;
      const resolved = await resolveGoogleNewsUrl(item.url);
      if (resolved) {
        results[i + j] = { ...item, url: resolved };
      }
    }));
  }
  return results;
}