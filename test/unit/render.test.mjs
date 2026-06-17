import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderIndustryPage, renderHomepage } from '../../src/pipeline/render.mjs';

const sampleData = {
  slug: 'ev-industry',
  prompt: 'electric vehicles',
  generated_at: '2026-06-16T10:00:00Z',
  companies: [
    { id: 'byd', name: 'BYD', region: 'cn', domain: 'byd.com', news: [
      { title: 'BYD news', snippet: 'snippet', url: 'https://byd.com/n1', source: 'byd.com', published_at: '2026-06-15T08:00:00Z' }
    ]},
    { id: 'catl', name: 'CATL', region: 'cn', domain: 'catl.com', news: [] },
    { id: 'nio', name: 'NIO', region: 'cn', domain: 'nio.com', news: [] },
    { id: 'tesla', name: 'Tesla', region: 'intl', domain: 'tesla.com', news: [] },
    { id: 'vw', name: 'Volkswagen', region: 'intl', domain: 'volkswagen.com', news: [] },
    { id: 'toyota', name: 'Toyota', region: 'intl', domain: 'toyota.com', news: [] },
  ],
};

test('renderIndustryPage includes all 6 company tabs', () => {
  const html = renderIndustryPage(sampleData);
  for (const c of sampleData.companies) {
    assert.match(html, new RegExp(`data-co="${c.id}"`));
  }
});

test('renderIndustryPage groups CN and intl with Chinese labels', () => {
  const html = renderIndustryPage(sampleData);
  assert.match(html, /中国/);
  assert.match(html, /国际/);
});

test('renderIndustryPage shows news count per tab as badge', () => {
  const html = renderIndustryPage(sampleData);
  assert.match(html, /BYD[\s\S]{0,60}<span class="count">1<\/span>/);
  assert.match(html, /Tesla[\s\S]{0,60}<span class="count">0<\/span>/);
});

test('renderIndustryPage escapes untrusted content', () => {
  const data = JSON.parse(JSON.stringify(sampleData));
  data.companies[0].news[0].title = '<script>alert(1)</script>';
  const html = renderIndustryPage(data);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('renderIndustryPage embeds dark mode styles', () => {
  const html = renderIndustryPage(sampleData);
  assert.match(html, /--bg:/);
  assert.match(html, /data-theme="dark"/);
});

test('renderIndustryPage renders summary section per company', () => {
  const html = renderIndustryPage(sampleData);
  assert.match(html, /本周要点/);
  assert.match(html, /BYD news/);
});

test('renderIndustryPage shows empty state in summary when no news', () => {
  const html = renderIndustryPage(sampleData);
  assert.match(html, /暂无该公司的近期新闻/);
});

test('renderIndustryPage uses Chinese UI labels', () => {
  const html = renderIndustryPage(sampleData);
  assert.match(html, /行业雷达/);
  assert.match(html, /家头部公司/);
  assert.match(html, /条新闻/);
  assert.match(html, /数据来源/);
});

test('renderIndustryPage respects first-section-visible default', () => {
  const html = renderIndustryPage(sampleData);
  const bydSection = html.match(/<section data-co="byd"[^>]*>/)[0];
  const catlSection = html.match(/<section data-co="catl"[^>]*>/)[0];
  assert.doesNotMatch(bydSection, /hidden/);
  assert.match(catlSection, /hidden/);
});

test('renderHomepage lists all industries', () => {
  const manifest = {
    industries: [
      { slug: 'ev-industry', prompt: 'electric vehicles', company_count: 6, news_count: 48, generated_at: '2026-06-16T10:00:00Z' },
      { slug: 'saas-industry', prompt: 'saas', company_count: 6, news_count: 30, generated_at: '2026-06-15T10:00:00Z' },
    ],
  };
  const html = renderHomepage(manifest);
  assert.match(html, /electric vehicles/);
  assert.match(html, /saas/);
  assert.match(html, /href="ev-industry\/"/);
  assert.match(html, /href="saas-industry\/"/);
});

test('renderHomepage shows Chinese empty state when no industries', () => {
  const html = renderHomepage({ industries: [] });
  assert.match(html, /暂无已生成的行业/);
});

test('renderHomepage uses Chinese UI labels', () => {
  const html = renderHomepage({ industries: [{ slug: 'x', prompt: 'x', company_count: 6, news_count: 10, generated_at: '2026-06-16T00:00:00Z' }] });
  assert.match(html, /行业新闻雷达/);
  assert.match(html, /家公司/);
  assert.match(html, /条新闻/);
});
