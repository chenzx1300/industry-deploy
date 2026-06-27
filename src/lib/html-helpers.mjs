export function escapeHtml(str) {
  if (str == null || str === 'unknown') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function relativeTime(isoString, now = new Date()) {
  const then = new Date(isoString);
  if (isNaN(then.getTime())) return '';
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(isoString);
}

// Extract a brief summary (meta description or og:description) from a URL.
// Returns empty string on failure. Files (PDF etc.) return empty.
export async function fetchMetaSummary(url, { fetchImpl = globalThis.fetch, timeout = 5000 } = {}) {
  if (!url) return '';
  // Skip files — no meta description
  if (/\.(pdf|docx?|xlsx?|zip|rar|jpg|jpeg|png|gif|webp|svg)$/i.test(url)) return '';
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0' },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return '';
    const html = await res.text();
    // Try meta description
    let m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']{20,300})["']/i);
    if (m) return m[1].trim();
    // Try og:description
    m = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']{20,300})["']/i);
    if (m) return m[1].trim();
    // Try twitter:description
    m = html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']{20,300})["']/i);
    if (m) return m[1].trim();
    return '';
  } catch {
    return '';
  }
}