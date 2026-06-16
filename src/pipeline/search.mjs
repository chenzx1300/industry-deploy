const TAVILY_URL = 'https://api.tavily.com/search';

export async function searchIndustry(prompt, { apiKey, fetchImpl = globalThis.fetch, maxRetries = 2 } = {}) {
  const body = {
    api_key: apiKey,
    query: `top ${prompt} companies 2026`,
    max_results: 20,
    search_depth: 'basic',
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchImpl(TAVILY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        return await res.json();
      }
      if (res.status >= 400 && res.status < 500) break; // don't retry 4xx
    } catch {
      // network error → retry
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  return { results: [] };
}
