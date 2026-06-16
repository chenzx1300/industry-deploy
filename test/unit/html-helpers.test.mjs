import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, formatDate, relativeTime } from '../../src/lib/html-helpers.mjs';

test('escapeHtml escapes special chars', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml("it's"), 'it&#39;s');
});

test('formatDate returns YYYY-MM-DD', () => {
  const iso = '2026-06-15T08:00:00Z';
  assert.equal(formatDate(iso), '2026-06-15');
});

test('formatDate handles invalid input gracefully', () => {
  assert.equal(formatDate('not-a-date'), 'unknown');
});

test('relativeTime computes recent past', () => {
  const now = new Date('2026-06-16T10:00:00Z');
  const oneHourAgo = '2026-06-16T09:00:00Z';
  assert.equal(relativeTime(oneHourAgo, now), '1h ago');
});

test('relativeTime returns just now for sub-minute', () => {
  const now = new Date('2026-06-16T10:00:00Z');
  assert.equal(relativeTime('2026-06-16T09:59:30Z', now), 'just now');
});

test('relativeTime computes days', () => {
  const now = new Date('2026-06-16T10:00:00Z');
  const threeDaysAgo = '2026-06-13T10:00:00Z';
  assert.equal(relativeTime(threeDaysAgo, now), '3d ago');
});