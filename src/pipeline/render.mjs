import { escapeHtml, formatDate, relativeTime } from '../lib/html-helpers.mjs';

function isFileUrl(url) {
  return /\.(pdf|docx?|xlsx?|zip|rar|jpg|jpeg|png|gif|webp|svg)$/i.test(url || '');
}

function safeMeta(value) {
  if (!value || value === 'unknown') return '';
  return value;
}

const STYLES = `
:root {
  --bg: #ffffff;
  --surface: #ffffff;
  --surface-soft: #f5f5f7;
  --surface-elevated: #ffffff;
  --border: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.16);
  --divider: rgba(0, 0, 0, 0.06);
  --text: #1d1d1f;
  --text-soft: #6e6e73;
  --text-faint: #86868b;
  --accent: #0071e3;
  --accent-hover: #0077ed;
  --accent-soft: rgba(0, 113, 227, 0.08);
  --accent-tint: rgba(0, 113, 227, 0.04);
  --cn-tint: #ff3b30;
  --intl-tint: #0071e3;
  --highlight: #fff8e6;
  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-serif: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Songti SC', serif;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.10);
  --radius-sm: 8px;
  --radius: 12px;
  --radius-lg: 18px;
}
[data-theme="dark"] {
  --bg: #000000;
  --surface: #1c1c1e;
  --surface-soft: #2c2c2e;
  --surface-elevated: #2c2c2e;
  --border: rgba(255, 255, 255, 0.10);
  --border-strong: rgba(255, 255, 255, 0.18);
  --divider: rgba(255, 255, 255, 0.06);
  --text: #f5f5f7;
  --text-soft: #98989d;
  --text-faint: #6e6e73;
  --accent: #0a84ff;
  --accent-hover: #409cff;
  --accent-soft: rgba(10, 132, 255, 0.16);
  --accent-tint: rgba(10, 132, 255, 0.06);
  --cn-tint: #ff453a;
  --intl-tint: #0a84ff;
  --highlight: #3a2e0a;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.6);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { background: var(--bg); }
body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  font-size: 17px;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: 'kern' 1, 'liga' 1;
}
.container { max-width: 980px; margin: 0 auto; padding: 64px 32px; }

.theme-toggle {
  position: fixed; top: 24px; right: 24px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 980px;
  cursor: pointer;
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-sans);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
  z-index: 10;
}
[data-theme="dark"] .theme-toggle {
  background: rgba(28, 28, 30, 0.72);
}
.theme-toggle:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
.theme-toggle:active { transform: translateY(0); }

header { margin-bottom: 56px; }
.chip {
  display: inline-block;
  background: var(--accent-tint);
  color: var(--accent);
  padding: 5px 12px;
  border-radius: 980px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  margin-bottom: 20px;
}
header h1 {
  font-family: var(--font-sans);
  font-size: 56px;
  font-weight: 700;
  line-height: 1.05;
  margin-bottom: 16px;
  letter-spacing: -0.03em;
}
header .meta {
  color: var(--text-soft);
  font-size: 15px;
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: center;
}
header .meta strong { color: var(--text); font-weight: 600; }
header .meta .dot { color: var(--text-faint); }

nav.tabs {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 40px 0 56px;
}
.region-block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 18px;
  transition: border-color 0.2s;
}
.region-block:hover { border-color: var(--border-strong); }
.region-block.cn { border-left: 3px solid var(--cn-tint); }
.region-block.intl { border-left: 3px solid var(--intl-tint); }
.region-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  text-transform: uppercase;
  margin-bottom: 10px;
}
.region-label .flag { font-size: 14px; }
.region-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
nav.tabs button {
  font-family: var(--font-sans);
  background: transparent;
  border: 1px solid transparent;
  padding: 10px 14px;
  cursor: pointer;
  color: var(--text-soft);
  font-size: 14.5px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  text-align: left;
  width: 100%;
}
nav.tabs button:hover {
  color: var(--text);
  background: var(--surface-soft);
}
nav.tabs button.active {
  color: var(--accent);
  background: var(--accent-tint);
  font-weight: 600;
}
nav.tabs .name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
nav.tabs .count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-faint);
  background: var(--surface-soft);
  padding: 1px 8px;
  border-radius: 980px;
  min-width: 24px;
  flex-shrink: 0;
}
nav.tabs button.active .count {
  color: var(--accent);
  background: var(--surface);
}

main section { margin-bottom: 56px; animation: fadeIn 0.3s ease; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
main section h2 {
  font-family: var(--font-sans);
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 4px;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.summary {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 28px 32px;
  margin-bottom: 36px;
  box-shadow: var(--shadow-sm);
}
.summary-label {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.summary-label::before {
  content: '';
  width: 18px;
  height: 1px;
  background: var(--accent);
}
.summary ul { list-style: none; margin-bottom: 16px; }
.summary li {
  padding: 10px 0 10px 22px;
  position: relative;
  font-size: 16px;
  line-height: 1.5;
  color: var(--text);
  border-bottom: 1px solid var(--divider);
  letter-spacing: -0.01em;
}
.summary li:last-child { border-bottom: none; }
.summary li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 18px;
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
}
.summary .stats {
  font-size: 13px;
  color: var(--text-soft);
  padding-top: 14px;
  border-top: 1px solid var(--divider);
}

.company-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--divider);
}
.company-header .logo {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 20px;
  letter-spacing: -0.02em;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.company-header .name-block { flex: 1; min-width: 0; }
.company-header h2 {
  font-family: var(--font-sans);
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 4px;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.company-header .domain {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 13px;
  color: var(--text-faint);
}

ul.news-list { list-style: none; }
li.news-item {
  padding: 22px 0;
  border-bottom: 1px solid var(--divider);
  transition: padding-left 0.2s;
}
li.news-item:hover { padding-left: 8px; }
a.news-title {
  color: var(--text);
  text-decoration: none;
  font-size: 19px;
  font-weight: 600;
  display: inline;
  line-height: 1.4;
  font-family: var(--font-sans);
  letter-spacing: -0.015em;
  transition: color 0.15s;
}
li.news-item:hover a.news-title { color: var(--accent); }
a.news-title .arrow {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-faint);
  margin-left: 4px;
  transition: color 0.15s;
}
li.news-item:hover a.news-title .arrow { color: var(--accent); }
p.news-snippet {
  color: var(--text-soft);
  font-size: 15px;
  margin: 8px 0 10px;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
span.news-meta {
  color: var(--text-faint);
  font-size: 13px;
  display: inline-flex;
  gap: 8px;
  align-items: center;
}
span.news-meta .dot { color: var(--border-strong); }
.empty {
  color: var(--text-soft);
  padding: 40px 0;
  text-align: center;
  font-size: 15px;
}
footer {
  margin-top: 96px;
  padding-top: 28px;
  border-top: 1px solid var(--divider);
  color: var(--text-faint);
  font-size: 13px;
  text-align: center;
}

.industry-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 40px;
}
.industry-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.industry-card:hover {
  border-color: var(--accent);
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}
.industry-card a {
  display: block;
  padding: 32px;
  text-decoration: none;
  color: var(--text);
}
.industry-card h3 {
  font-family: var(--font-sans);
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 10px;
  letter-spacing: -0.02em;
}
.industry-card .stats {
  color: var(--text-soft);
  font-size: 14px;
  display: flex;
  gap: 10px;
}
.industry-card time {
  display: block;
  color: var(--text-faint);
  font-size: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--divider);
}
.empty-state {
  text-align: center;
  padding: 96px 32px;
  color: var(--text-soft);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.empty-state code {
  font-family: ui-monospace, 'SF Mono', 'Menlo', monospace;
  background: var(--surface-soft);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 13px;
}

@media (max-width: 640px) {
  .container { padding: 48px 20px; }
  header h1 { font-size: 36px; }
  .region-tabs { grid-template-columns: 1fr; }
  main section h2 { font-size: 28px; }
  .theme-toggle { top: 16px; right: 16px; padding: 6px 12px; font-size: 12px; }
  .industry-grid { grid-template-columns: 1fr; }
}
`;

const SCRIPT = `
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.co;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('section[data-co]').forEach(s => s.hidden = s.dataset.co !== target);
    tab.classList.add('active');
    history.replaceState(null, '', '#' + target);
  });
});
window.addEventListener('DOMContentLoaded', () => {
  const hash = location.hash.replace('#', '');
  if (hash) {
    const tab = document.querySelector('.tab[data-co="' + hash + '"]');
    if (tab) tab.click();
  }
  const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  const btn = document.querySelector('.theme-toggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️ 浅色' : '🌙 深色';
    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
      btn.textContent = next === 'dark' ? '☀️ 浅色' : '🌙 深色';
    });
  }
});
`;

function pageShell(title, body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} · 行业雷达</title>
<style>${STYLES}</style>
</head>
<body>
${body}
<script>${SCRIPT}</script>
</body>
</html>`;
}

// Render an SVG monogram (1-2 chars in a colored rounded square).
// Use as a stand-in for the company logo when we can't fetch the real one.
function monogramSvg(text, color) {
  return `<svg class="logo" width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="48" height="48" rx="10" fill="${escapeHtml(color)}"/>
    <text x="24" y="33" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="20" font-weight="700" fill="#ffffff">${escapeHtml(text)}</text>
  </svg>`;
}

// Build a "this week's highlights" summary from the top 3 headlines.
function buildSummary(company) {
  if (!company.news || company.news.length === 0) {
    return '<div class="empty">暂无该公司的近期新闻。</div>';
  }
  const top = company.news.slice(0, 3);
  const items = top.map(n => `<li>${escapeHtml(n.title)}</li>`).join('');
  const lastDate = formatDate(company.news[0].published_at);
  const stats = lastDate
    ? `${company.news.length} 条新闻 · 最近 ${lastDate}`
    : `${company.news.length} 条新闻`;
  return `<div class="summary"><div class="summary-label">本周要点</div><ul>${items}</ul><div class="stats">${escapeHtml(stats)}</div></div>`;
}

export function renderIndustryPage(data) {
  const cn = data.companies.filter(c => c.region === 'cn');
  const intl = data.companies.filter(c => c.region === 'intl');
  const totalNews = data.companies.reduce((sum, c) => sum + c.news.length, 0);
  const now = new Date(data.generated_at);

  const tabsHtml = (companies, region) =>
    `<div class="region-block ${region}">
      <div class="region-label">${region === 'cn' ? '中国头部' : '国际头部'}</div>
      <div class="region-tabs">
        ${companies.map(c =>
          `<button class="tab" data-co="${escapeHtml(c.id)}"><span class="name">${escapeHtml(c.name)}</span><span class="count">${c.news.length}</span></button>`
        ).join('')}
      </div>
    </div>`;

  const sectionsHtml = data.companies.map((c, idx) => {
    const newsList = c.news.length === 0
      ? '<p class="empty">暂无该公司的近期新闻。</p>'
      : `<ul class="news-list">
        ${c.news.map(n => {
          // Show snippet only when present AND URL isn't a file (PDF etc.)
          const snippet = (n.snippet && !isFileUrl(n.url)) ? escapeHtml(n.snippet) : '';
          // Build meta line; skip empty fields
          const source = safeMeta(n.source);
          const date = formatDate(n.published_at);
          const rel = relativeTime(n.published_at, now);
          const metaBits = [source, date, rel].filter(Boolean);
          const metaHtml = metaBits.length
            ? `<span class="news-meta">${metaBits.map(b => `<span>${escapeHtml(b)}</span>`).join('<span class="dot">·</span>')}</span>`
            : '';
          return `
          <li class="news-item">
            <a class="news-title" href="${escapeHtml(n.url)}" target="_blank" rel="noopener">${escapeHtml(n.title)}<span class="arrow">↗</span></a>
            ${snippet ? `<p class="news-snippet">${snippet}</p>` : ''}
            ${metaHtml}
          </li>`;
        }).join('')}
      </ul>`;
    const monoChar = (c.monogram || c.name.charAt(0)).slice(0, 2);
    const monoColor = c.monogram_color || '#475569';
    // Default visible section: data.default_id if set, else first company.
    const defaultId = data.default_id || data.companies[0]?.id;
    const isVisible = c.id === defaultId;
    return `
    <section data-co="${escapeHtml(c.id)}"${isVisible ? '' : ' hidden'}>
      <div class="company-header">
        ${monogramSvg(monoChar, monoColor)}
        <div class="name-block">
          <h2>${escapeHtml(c.name)}</h2>
          <span class="domain">${escapeHtml(c.domain)}</span>
        </div>
      </div>
      ${buildSummary(c)}
      ${newsList}
    </section>`;
  }).join('');

  const body = `
<div class="container">
  <header>
    <span class="chip">行业雷达</span>
    <h1>${escapeHtml(data.prompt)}</h1>
    <p class="meta">
      <span><strong>6 家头部公司</strong></span>
      <span>${totalNews} 条新闻</span>
      <span>生成于 ${formatDate(data.generated_at)}</span>
    </p>
  </header>
  <nav class="tabs">
    ${tabsHtml(cn, 'cn')}
    ${tabsHtml(intl, 'intl')}
  </nav>
  <main>${sectionsHtml}</main>
  <footer>数据来源：Google News · 生成于 ${formatDate(data.generated_at)} · 仅供参考</footer>
</div>`;

  return pageShell(data.prompt, body);
}

export function renderHomepage(manifest) {
  const cards = manifest.industries.map(i => `
    <li class="industry-card">
      <a href="${escapeHtml(i.slug)}/">
        <h3>${escapeHtml(i.prompt)}</h3>
        <span class="stats">
          <span>${i.company_count} 家公司</span>
          <span>·</span>
          <span>${i.news_count} 条新闻</span>
        </span>
        <time>生成于 ${formatDate(i.generated_at)}</time>
      </a>
    </li>
  `).join('');

  const inner = manifest.industries.length === 0
    ? `<div class="empty-state">暂无已生成的行业。<br><br>运行 <code>npm run build -- "&lt;行业&gt;"</code> 生成第一个。</div>`
    : `<ul class="industry-grid">${cards}</ul>`;

  const body = `
<div class="container">
  <header>
    <span class="chip">行业雷达</span>
    <h1>行业新闻雷达</h1>
    <p class="meta"><span>头部公司的最新动态</span><span class="dot">·</span><span>本地生成</span></p>
  </header>
  <main>${inner}</main>
  <footer>本地生成 · 数据来源：Google News</footer>
</div>`;

  return pageShell('行业新闻雷达', body);
}
