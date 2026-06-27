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
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime()) || d.getUTCFullYear() < 2000) return '';
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

// Extract a brief summary (meta description or first paragraph) from a URL.
// Returns empty string on failure. Files (PDF etc.) return empty.
// Multi-stage extraction:
//   1. <meta name="description">  (most common)
//   2. <meta property="og:description">
//   3. <meta name="twitter:description">
//   4. First non-trivial <p> tag content (regex extraction — fast, no DOM parse)
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
    let m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']{30,400})["']/i);
    if (m) return decodeHtml(m[1].trim());

    // Try og:description
    m = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']{30,400})["']/i);
    if (m) return decodeHtml(m[1].trim());

    // Try twitter:description
    m = html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']{30,400})["']/i);
    if (m) return decodeHtml(m[1].trim());

    // Fallback: extract first non-trivial <p> tag content from <article> or <main> or body
    // Strip scripts/styles/comments first
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Prefer <article> content
    const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const scope = articleMatch ? articleMatch[1] : cleaned;

    // Find <p> tags with at least 60 chars of text
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pMatch;
    while ((pMatch = pRegex.exec(scope)) !== null) {
      const text = stripTags(pMatch[1]).trim().replace(/\s+/g, ' ');
      if (text.length >= 60 && !isBoilerplate(text)) {
        // Truncate to ~200 chars at word boundary
        return truncateSentence(text, 240);
      }
    }
    return '';
  } catch {
    return '';
  }
}

// Helpers
function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '');
}

function isBoilerplate(text) {
  const t = text.toLowerCase();
  // Common nav/menu/cookie/consent boilerplate
  if (/cookie|consent|subscribe|sign up|log in|privacy policy|terms of use/.test(t)) return true;
  if (/skip to (main )?content/.test(t)) return true;
  if (/all rights reserved/.test(t)) return true;
  // Nav menu text — sequences of single-word section names concatenated
  if (/^(sections|menu|navigation|home|about|contact|careers|blog|news|opinion|sports|arts|business|tech|lifestyle|world|politics|metro|video|podcasts|newsletters?|magazines?|multimedia|programs?|events?|donate|search|login|register|account)($|\s)/i.test(t)) return true;
  // Nav menu: lots of capitalised words with no spaces between (SectionsNewsOpinionArtsBlog)
  if (/^[A-Z][a-z]+(?:[A-Z][a-z]+){3,}/.test(text.replace(/[^A-Za-z]/g, ''))) return true;
  // All-caps menu items like "HOMENEWSBUSINESS..."
  if (/^[A-Z]{20,}$/.test(t.replace(/\s/g, ''))) return true;
  // Contains 5+ category-like words (heuristic for nav lists)
  const navWords = (t.match(/\b(news|opinion|sports|arts|blog|metro|business|tech|world|politics|culture|lifestyle|food|travel|health|education|science|tech|entertainment|music|film|books|opinion|cart|account|search|login|signup|home|about|contact|jobs|subscribe|newsletter|donate|store|shop)\b/g) || []).length;
  if (navWords >= 5) return true;
  return false;
}

function truncateSentence(text, maxLen) {
  if (text.length <= maxLen) return text;
  // Cut at sentence boundary if possible
  const cut = text.slice(0, maxLen);
  const lastSentence = cut.search(/[。.!?！？]\s/);
  if (lastSentence > maxLen * 0.5) {
    return cut.slice(0, lastSentence + 1).trim();
  }
  // Otherwise cut at last space
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.5) {
    return cut.slice(0, lastSpace).trim() + '…';
  }
  return cut.trim() + '…';
}

// Extract a publication date from a news title (returns ISO string or null).
// Handles common formats:
//   "2025/09/08" / "2025-09-08" / "2025年09月08日"
//   "Sep 8, 2025" / "8 Sep 2025"
//   "Q1 2025" / "Q3 2026"
//   "2025年9月"
export function extractDateFromTitle(title) {
  if (!title) return null;
  const t = title;

  // ISO-like: 2025/09/08 or 2025-09-08
  let m = t.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T00:00:00Z`;
  }

  // Chinese: 2025年09月08日
  m = t.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T00:00:00Z`;
  }

  // Chinese: 2025年9月 (no day — use 1st)
  m = t.match(/(\d{4})年(\d{1,2})月(?!(\d))?/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-01T00:00:00Z`;
  }

  // "Sep 8, 2025" / "Sept. 8 2025" (English)
  const monthMap = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  m = t.match(/(\bJan\b|\bFeb\b|\bMar\b|\bApr\b|\bMay\b|\bJun\b|\bJul\b|\bAug\b|\bSep\b|\bOct\b|\bNov\b|\bDec\b)\w*\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m) {
    const month = monthMap[m[1].slice(0, 3).toLowerCase()];
    if (month) return `${m[3]}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}T00:00:00Z`;
  }

  // "8 Sep 2025" (English)
  m = t.match(/(\d{1,2})\s+(\bJan\b|\bFeb\b|\bMar\b|\bApr\b|\bMay\b|\bJun\b|\bJul\b|\bAug\b|\bSep\b|\bOct\b|\bNov\b|\bDec\b)\w*\s+(\d{4})/i);
  if (m) {
    const month = monthMap[m[2].slice(0, 3).toLowerCase()];
    if (month) return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}T00:00:00Z`;
  }

  // Q1 2025 / Q3 2026 — use middle of quarter
  m = t.match(/Q([1-4])\s+(\d{4})/i);
  if (m) {
    const qMid = [+m[1]] * 3 - 1; // Q1->Feb, Q2->May, Q3->Aug, Q4->Nov
    return `${m[2]}-${String(qMid).padStart(2, '0')}-15T00:00:00Z`;
  }

  return null;
}
export function fileTypeFromUrl(url) {
  if (!url) return '';
  const m = url.match(/\.([a-z0-9]+)(?:\?.*)?$/i);
  if (!m) return '';
  const ext = m[1].toLowerCase();
  const known = {
    pdf: 'PDF',
    doc: 'DOC', docx: 'DOC',
    xls: 'XLS', xlsx: 'XLS',
    ppt: 'PPT', pptx: 'PPT',
    zip: 'ZIP', rar: 'RAR',
    csv: 'CSV',
    mp3: 'MP3', mp4: 'MP4',
  };
  return known[ext] || ext.toUpperCase().slice(0, 4);
}

// Detect news source type from URL (best-effort heuristic).
export function newsTypeFromUrl(url, title = '') {
  if (!url) return '';
  if (/\.pdf/i.test(url)) return '文档';
  if (/ir\.|investor|press|news|newsroom|media/i.test(url)) return '新闻稿';
  if (/blog|article|story|post/i.test(url)) return '文章';
  if (/video|youtube|youtu\.be|vimeo/i.test(url)) return '视频';
  if (/twitter\.com|x\.com/i.test(url)) return '社交';
  return '';
}