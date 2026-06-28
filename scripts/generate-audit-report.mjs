#!/usr/bin/env node
// Read data/translate-report.json and write a human-friendly audit report
// to docs/audit-report.html that the user can open in a browser to review
// every translation side-by-side.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'data/translate-report.json';
if (!existsSync(SRC)) {
  console.error('No translate-report.json found — run scripts/translate-news.mjs first.');
  process.exit(1);
}
const r = JSON.parse(readFileSync(SRC, 'utf-8'));

const items = r.all_translations || [];
const low = r.low_confidence || [];

// Stats per industry
const bySlug = {};
for (const it of items) {
  bySlug[it.slug] ??= { total: 0, applied: 0, low: 0 };
  bySlug[it.slug].total++;
  if (it.applied) bySlug[it.slug].applied++;
  if (!it.applied) bySlug[it.slug].low++;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function row(it, isLow) {
  return `
  <tr class="${isLow ? 'low' : ''}">
    <td class="meta">
      <div class="slug">${escapeHtml(it.slug)}</div>
      <div class="co">${escapeHtml(it.company)}</div>
      <div class="conf conf-${it.confidence >= 0.8 ? 'hi' : it.confidence >= 0.5 ? 'mid' : 'lo'}">${(it.confidence * 100).toFixed(0)}%</div>
      <div class="${it.applied ? 'applied' : 'skipped'}">${it.applied ? '✓ applied' : '⚠ skipped'}</div>
    </td>
    <td class="text">
      <div class="label">原文 / Source</div>
      <div class="title">${escapeHtml(it.orig.title)}</div>
      ${it.orig.snippet ? `<div class="snippet">${escapeHtml(it.orig.snippet)}</div>` : ''}
    </td>
    <td class="text">
      <div class="label">译文 / Translation</div>
      <div class="title">${escapeHtml(it.translated.title) || '<em class="empty">(empty)</em>'}</div>
      ${it.translated.snippet ? `<div class="snippet">${escapeHtml(it.translated.snippet)}</div>` : '<em class="empty">(empty)</em>'}
    </td>
    <td class="url"><a href="${escapeHtml(it.url)}" target="_blank" rel="noopener">${escapeHtml(it.url.replace(/^https?:\/\//, '').slice(0, 50))}</a></td>
  </tr>`;
}

const statsHtml = Object.entries(bySlug).map(([slug, s]) =>
  `<tr><td>${escapeHtml(slug)}</td><td>${s.total}</td><td>${s.applied}</td><td>${s.low}</td></tr>`
).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>翻译审核报告 · 行业雷达</title>
<style>
:root { --bg:#fff; --text:#1a1a1a; --muted:#666; --accent:#c00; --hi-bg:#f0fdf4; --mid-bg:#fefce8; --lo-bg:#fef2f2; --border:#e8e8e8; }
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 24px; }
h1 { font-size: 24px; margin: 0 0 8px; }
h2 { font-size: 16px; margin: 24px 0 12px; padding-top: 16px; border-top: 1px solid var(--border); }
p.lead { color: var(--muted); margin: 0 0 24px; }
table.summary { border-collapse: collapse; margin: 16px 0; }
table.summary th, table.summary td { padding: 8px 16px; border: 1px solid var(--border); text-align: left; font-size: 13px; }
table.summary th { background: #fafafa; }
table.review { border-collapse: collapse; width: 100%; font-size: 13px; }
table.review th { padding: 12px 8px; border-bottom: 2px solid var(--accent); text-align: left; font-weight: 600; background: #fafafa; position: sticky; top: 0; }
table.review td { padding: 12px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
table.review tr.low { background: var(--lo-bg); }
table.review tr:hover { background: var(--mid-bg); }
td.meta { width: 180px; }
td.text { width: 38%; }
td.url { width: 200px; word-break: break-all; }
td.url a { color: var(--accent); text-decoration: none; }
.meta .slug { font-size: 11px; color: var(--muted); }
.meta .co { font-weight: 600; margin: 4px 0; }
.conf { display: inline-block; padding: 2px 8px; border-radius: 3px; font-family: monospace; font-size: 11px; margin: 4px 0; }
.conf-hi { background: var(--hi-bg); color: #166534; }
.conf-mid { background: var(--mid-bg); color: #854d0e; }
.conf-lo { background: var(--lo-bg); color: #991b1b; }
.applied { color: #166534; font-size: 11px; }
.skipped { color: #991b1b; font-size: 11px; }
.text .label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.text .title { font-weight: 600; margin-bottom: 6px; line-height: 1.4; }
.text .snippet { color: var(--muted); font-size: 12px; line-height: 1.5; }
.empty { color: var(--muted); font-style: italic; }
.filters { margin: 16px 0; }
.filters button { padding: 6px 12px; margin-right: 6px; border: 1px solid var(--border); background: #fff; cursor: pointer; border-radius: 4px; font-size: 13px; }
.filters button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
</style>
</head>
<body>
<h1>翻译审核报告</h1>
<p class="lead">生成于 ${new Date().toISOString().slice(0, 19)} · 共 ${items.length} 条翻译 · ${low.length} 条低置信度（&lt;80% 被跳过）</p>

<h2>按行业汇总</h2>
<table class="summary">
  <thead><tr><th>行业 / Industry</th><th>总翻译数</th><th>已应用</th><th>低置信跳过</th></tr></thead>
  <tbody>${statsHtml}</tbody>
</table>

<h2>所有翻译（按行业 / 公司排序）</h2>
<p style="color:var(--muted); font-size:12px;">低置信度（&lt;80%）的行被标红、未写入 JSON。如有错误可手动编辑 data/&lt;slug&gt;.json。</p>
<div class="filters">
  <button onclick="filterRows('all')" class="active" data-f="all">全部</button>
  <button onclick="filterRows('applied')" data-f="applied">已应用</button>
  <button onclick="filterRows('skipped')" data-f="skipped">已跳过</button>
  <button onclick="filterRows('low')" data-f="low">仅低置信 (${low.length})</button>
</div>

<table class="review">
  <thead><tr><th>行业 / 公司 / 置信度</th><th>原文 (英文)</th><th>译文 (中文)</th><th>链接</th></tr></thead>
  <tbody>
    ${items.map(it => row(it, !it.applied)).join('')}
  </tbody>
</table>

<script>
function filterRows(filter) {
  document.querySelectorAll('button[data-f]').forEach(b => b.classList.toggle('active', b.dataset.f === filter));
  document.querySelectorAll('table.review tbody tr').forEach(r => {
    const applied = r.querySelector('.applied') !== null;
    const low = r.classList.contains('low');
    r.style.display = (
      filter === 'all' ? '' :
      filter === 'applied' ? (applied ? '' : 'none') :
      filter === 'skipped' ? (!applied ? '' : 'none') :
      filter === 'low' ? (low ? '' : 'none') :
      ''
    );
  });
}
</script>
</body>
</html>`;

writeFileSync('docs/audit-report.html', html, 'utf-8');
console.log(`✓ Wrote docs/audit-report.html (${items.length} rows)`);
console.log(`  Total: ${items.length}  Applied: ${items.filter(x => x.applied).length}  Skipped: ${low.length}`);