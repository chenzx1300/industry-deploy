import { escapeHtml, formatDate, relativeTime } from '../lib/html-helpers.mjs';

const STYLES = `
:root {
  --bg: #fafaf7;
  --surface: #ffffff;
  --surface-soft: #f4f2ed;
  --border: #e8e4dc;
  --border-strong: #d6d1c5;
  --text: #1a1a1a;
  --text-soft: #5a5a5a;
  --text-faint: #8a8a8a;
  --accent: #1e40af;
  --accent-soft: rgba(30, 64, 175, 0.08);
  --cn-tint: #b91c1c;
  --intl-tint: #1e40af;
  --highlight: #fef3c7;
  --highlight-dark: #422006;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-serif: 'Source Serif Pro', 'Georgia', 'Songti SC', 'STSong', serif;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --radius: 8px;
}
[data-theme="dark"] {
  --bg: #0a0a0a;
  --surface: #141414;
  --surface-soft: #1c1c1c;
  --border: #2a2a2a;
  --border-strong: #3a3a3a;
  --text: #f5f5f4;
  --text-soft: #a8a8a8;
  --text-faint: #707070;
  --accent: #93c5fd;
  --accent-soft: rgba(147, 197, 253, 0.12);
  --highlight: #422006;
  --highlight-dark: #fef3c7;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { background: var(--bg); }
body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text);
  line-height: 1.65;
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.container { max-width: 960px; margin: 0 auto; padding: 48px 32px; }

.theme-toggle {
  position: fixed; top: 20px; right: 24px;
  background: var(--surface); border: 1px solid var(--border);
  padding: 8px 14px; border-radius: 20px;
  cursor: pointer; color: var(--text);
  font-size: 13px; font-family: var(--font-sans);
  box-shadow: var(--shadow-sm);
  transition: all 0.15s;
  z-index: 10;
}
.theme-toggle:hover { border-color: var(--border-strong); transform: translateY(-1px); }

header { margin-bottom: 40px; }
.chip {
  display: inline-block;
  background: var(--accent-soft);
  color: var(--accent);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  margin-bottom: 16px;
}
header h1 {
  font-family: var(--font-serif);
  font-size: 44px;
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 12px;
  letter-spacing: -0.02em;
}
header .meta {
  color: var(--text-soft);
  font-size: 14px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
header .meta strong { color: var(--text); font-weight: 600; }
header .meta .dot { color: var(--text-faint); }

nav.tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin: 32px 0 40px;
  padding: 6px;
  background: var(--surface-soft);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  align-items: center;
}
nav.tabs .region-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 0 14px 0 8px;
  color: var(--text-faint);
  flex-shrink: 0;
}
nav.tabs .region-divider {
  width: 1px;
  height: 18px;
  background: var(--border-strong);
  margin: 0 4px;
  flex-shrink: 0;
}
nav.tabs button {
  font-family: var(--font-serif);
  background: transparent;
  border: none;
  padding: 8px 14px;
  cursor: pointer;
  color: var(--text-soft);
  font-size: 15px;
  border-radius: 6px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 8px;
}
nav.tabs button:hover { color: var(--text); background: var(--surface); }
nav.tabs button.active {
  color: var(--text);
  background: var(--surface);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
nav.tabs .count {
  display: inline-block;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-faint);
  background: var(--surface-soft);
  padding: 2px 7px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}
nav.tabs button.active .count { color: var(--accent); background: var(--accent-soft); }

main section { margin-bottom: 48px; }
main section h2 {
  font-family: var(--font-serif);
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
  letter-spacing: -0.01em;
}
main section .company-meta {
  display: flex;
  gap: 16px;
  align-items: center;
  color: var(--text-soft);
  font-size: 14px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
main section .company-meta .domain {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 13px;
  color: var(--text-faint);
}

.summary {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius);
  padding: 24px 28px;
  margin-bottom: 32px;
  box-shadow: var(--shadow-sm);
}
.summary h3 {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--accent);
  text-transform: uppercase;
  margin-bottom: 14px;
}
.summary ul {
  list-style: none;
  margin-bottom: 14px;
}
.summary li {
  padding: 8px 0 8px 20px;
  position: relative;
  font-size: 15px;
  line-height: 1.5;
  color: var(--text);
  border-bottom: 1px dashed var(--border);
}
.summary li:last-child { border-bottom: none; }
.summary li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 16px;
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
}
.summary .stats {
  font-size: 13px;
  color: var(--text-soft);
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

ul.news-list { list-style: none; }
li.news-item {
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
  transition: padding-left 0.2s;
}
li.news-item:hover { padding-left: 12px; }
li.news-item:hover .news-title { color: var(--accent); }
a.news-title {
  color: var(--text);
  text-decoration: none;
  font-size: 17px;
  font-weight: 600;
  display: block;
  margin-bottom: 8px;
  line-height: 1.4;
  font-family: var(--font-serif);
  letter-spacing: -0.005em;
}
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
  font-size: 14.5px;
  margin-bottom: 8px;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
span.news-meta {
  color: var(--text-faint);
  font-size: 12.5px;
  display: inline-flex;
  gap: 8px;
  align-items: center;
}
span.news-meta .dot { color: var(--border-strong); }
.empty {
  color: var(--text-soft);
  font-style: italic;
  padding: 32px 0;
  text-align: center;
}
footer {
  margin-top: 80px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  color: var(--text-faint);
  font-size: 12.5px;
  text-align: center;
}

.industry-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 32px;
}
.industry-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: all 0.2s;
  overflow: hidden;
}
.industry-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.industry-card a {
  display: block;
  padding: 24px;
  text-decoration: none;
  color: var(--text);
}
.industry-card h3 {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 8px;
  letter-spacing: -0.01em;
}
.industry-card .stats {
  color: var(--text-soft);
  font-size: 13.5px;
  display: flex;
  gap: 12px;
}
.industry-card time {
  display: block;
  color: var(--text-faint);
  font-size: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.empty-state {
  text-align: center;
  padding: 80px 24px;
  color: var(--text-soft);
  background: var(--surface);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
}
.empty-state code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  background: var(--surface-soft);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
}

@media (max-width: 640px) {
  .container { padding: 32px 16px; }
  header h1 { font-size: 32px; }
  nav.tabs { overflow-x: auto; flex-wrap: nowrap; -webkit-overflow-scrolling: touch; }
  nav.tabs button { white-space: nowrap; flex-shrink: 0; }
  main section h2 { font-size: 24px; }
  .theme-toggle { top: 12px; right: 12px; padding: 6px 10px; font-size: 12px; }
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

// Build a "this week's highlights" summary from the top 3 headlines.
function buildSummary(company) {
  if (!company.news || company.news.length === 0) {
    return '<div class="empty">暂无该公司的近期新闻。</div>';
  }
  const top = company.news.slice(0, 3);
  const items = top.map(n => `<li>${escapeHtml(n.title)}</li>`).join('');
  const stats = `${company.news.length} 条新闻 · 最近更新 ${relativeTime(company.news[0].published_at, new Date())}`;
  return `<div class="summary"><h3>本周要点</h3><ul>${items}</ul><div class="stats">${escapeHtml(stats)}</div></div>`;
}

export function renderIndustryPage(data) {
  const cn = data.companies.filter(c => c.region === 'cn');
  const intl = data.companies.filter(c => c.region === 'intl');
  const totalNews = data.companies.reduce((sum, c) => sum + c.news.length, 0);
  const now = new Date(data.generated_at);

  const tabsHtml = (companies) =>
    companies.map(c =>
      `<button class="tab" data-co="${escapeHtml(c.id)}">${escapeHtml(c.name)}<span class="count">${c.news.length}</span></button>`
    ).join('');

  const sectionsHtml = data.companies.map((c, idx) => {
    const regionLabel = c.region === 'cn' ? '中国' : '国际';
    const newsList = c.news.length === 0
      ? '<p class="empty">暂无该公司的近期新闻。</p>'
      : `<ul class="news-list">
        ${c.news.map(n => `
          <li class="news-item">
            <a class="news-title" href="${escapeHtml(n.url)}" target="_blank" rel="noopener">${escapeHtml(n.title)}<span class="arrow">↗</span></a>
            <p class="news-snippet">${escapeHtml(n.snippet)}</p>
            <span class="news-meta">
              <span>${escapeHtml(n.source)}</span>
              <span class="dot">·</span>
              <span>${formatDate(n.published_at)}</span>
              <span class="dot">·</span>
              <span>${relativeTime(n.published_at, now)}</span>
            </span>
          </li>
        `).join('')}
      </ul>`;
    return `
    <section data-co="${escapeHtml(c.id)}"${idx !== 0 ? ' hidden' : ''}>
      <h2>${escapeHtml(c.name)}</h2>
      <div class="company-meta">
        <span>${regionLabel}</span>
        <span class="dot">·</span>
        <span class="domain">${escapeHtml(c.domain)}</span>
        <span class="dot">·</span>
        <span>${c.news.length} 条新闻</span>
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
      <span class="dot">·</span>
      <span>${totalNews} 条新闻</span>
      <span class="dot">·</span>
      <span>生成于 ${formatDate(data.generated_at)}</span>
    </p>
  </header>
  <nav class="tabs">
    <span class="region-label">🇨🇳 中国</span>
    ${tabsHtml(cn)}
    <span class="region-divider"></span>
    <span class="region-label">🌍 国际</span>
    ${tabsHtml(intl)}
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
