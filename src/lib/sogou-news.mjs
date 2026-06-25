// Sogou WeChat search news fetcher. WeChat (微信) public accounts are the dominant
// source of Chinese-language tech / business news. Sogou indexes them and returns
// titles + WeChat article URLs (which are CN-accessible, fast).
//
// Strategy:
//   1. Search Sogou WeChat for [company] keywords
//   2. Parse the result page to extract {title, sogou-redirect-url} pairs
//   3. Resolve each sogou-redirect-url to the actual WeChat article URL
//      (or external site URL if the article is from a different domain)
//   4. Return as {title, url, source, published_at}
//
// China-friendly: WeChat article URLs (mp.weixin.qq.com/s?__biz=...) are accessible
// in mainland China without VPN.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

import { JSDOM } from 'jsdom';

/**
 * Search Sogou WeChat for [query] and return list of {title, sogouUrl, rawHref}.
 */
export async function searchSogouWeChat(query, {
  fetchImpl = globalThis.fetch,
  timeout = 12000,
  maxResults = 15,
} = {}) {
  if (!query) return [];
  const url = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(query)}`;
  let html;
  try {
    const res = await fetchImpl(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml',
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

  // Each news item: <a data-z="art" href="/link?url=...">  within <li>
  const anchors = [...doc.querySelectorAll('a[data-z="art"]')];
  const items = [];
  for (const a of anchors) {
    const href = a.getAttribute('href');
    if (!href) continue;
    // Title: search the parent <li> for the most likely <p> with the article title.
    // Sogou puts title text in <p> tags. Find the longest reasonable <p>.
    const li = a.closest('li');
    let title = '';
    if (li) {
      const ps = [...li.querySelectorAll('p')];
      let bestLen = 0;
      for (const p of ps) {
        const t = (p.textContent || '').trim().replace(/\s+/g, ' ');
        if (t.length > 12 && t.length < 220 && t.length > bestLen
            && !/^微信|公众号|扫码|关注/.test(t)) {
          title = t;
          bestLen = t.length;
        }
      }
    }
    if (!title) title = (a.textContent || '').trim().replace(/\s+/g, ' ');
    if (title.length >= 12 && title.length < 220) {
      items.push({ title, sogouUrl: href.startsWith('http') ? href : 'https://weixin.sogou.com' + href });
      if (items.length >= maxResults) break;
    }
  }
  return items;
}

/**
 * Resolve a Sogou /link?url=... redirect to its actual target URL.
 * Sogou redirects are 302 responses to the publisher's real article URL.
 * Returns null if resolution fails or the target is itself sogou.
 */
export async function resolveSogouUrl(sogouUrl, {
  fetchImpl = globalThis.fetch,
  timeout = 8000,
} = {}) {
  if (!sogouUrl) return null;
  try {
    const res = await fetchImpl(sogouUrl, {
      method: 'GET',  // Sogou's /link endpoint may not redirect on HEAD
      redirect: 'follow',
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(timeout),
    });
    const finalUrl = res.url;
    if (!finalUrl || finalUrl.includes('sogou.com')) return null;
    // Avoid settling on the Sogou "antibot" intermediate page
    if (/antispider|captcha|verify/i.test(finalUrl)) return null;
    return finalUrl;
  } catch {
    return null;
  }
}

/**
 * Resolve a batch of Sogou items to actual article URLs in parallel.
 */
export async function resolveSogouUrls(items, { concurrency = 4 } = {}) {
  const results = [...items];
  for (let i = 0; i < results.length; i += concurrency) {
    const batch = results.slice(i, i + concurrency);
    await Promise.all(batch.map(async (_item, j) => {
      const resolved = await resolveSogouUrl(results[i + j].sogouUrl);
      if (resolved) {
        results[i + j] = { ...results[i + j], url: resolved };
      } else {
        // Keep sogouUrl as fallback (still better than empty)
        results[i + j] = { ...results[i + j], url: results[i + j].sogouUrl };
      }
    }));
  }
  return results;
}

/**
 * One-shot fetch: search Sogou WeChat and resolve URLs. Returns array of
 * {title, url, source, published_at: null} ready for use as news items.
 */
export async function fetchSogouWeChatNews(query, opts = {}) {
  const maxResults = opts.maxResults || 15;
  const items = await searchSogouWeChat(query, { maxResults });
  if (items.length === 0) return [];
  const resolved = await resolveSogouUrls(items);
  return resolved.map(it => {
    let source = 'unknown';
    try { source = new URL(it.url).hostname.replace(/^www\./, ''); } catch {}
    return { title: it.title, url: it.url, source, published_at: null };
  });
}