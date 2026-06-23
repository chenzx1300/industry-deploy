// Resolve Google News RSS redirect URLs to the actual publisher article URL.
// Google News returns links like:
//   https://news.google.com/rss/articles/CBMi...?oc=5
// which 302-redirect to the real article. Following the Location header
// gives us the direct URL on the publisher's domain (works in China).

export async function resolveGoogleNewsUrl(googleUrl, { fetchImpl = globalThis.fetch, timeout = 5000 } = {}) {
  if (!googleUrl || !googleUrl.includes('news.google.com')) return googleUrl;
  try {
    const res = await fetchImpl(googleUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeout),
      headers: { 'User-Agent': 'Mozilla/5.0 (industry-news-radar/1.0)' },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (location) return location;
    }
    return googleUrl;
  } catch {
    return googleUrl;
  }
}

export async function resolveGoogleNewsUrls(items, opts = {}) {
  const { concurrency = 8 } = opts;
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = { ...items[i], url: await resolveGoogleNewsUrl(items[i].url, opts) };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}