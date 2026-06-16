import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, buildSlug } from '../../src/pipeline/slugify.mjs';

test('slugify lowercases and hyphenates spaces', () => {
  assert.equal(slugify('New Energy Vehicles'), 'new-energy-vehicles');
});

test('slugify strips special chars', () => {
  assert.equal(slugify('AI/ML & Robotics!'), 'ai-ml-robotics');
});

test('slugify collapses multiple hyphens', () => {
  assert.equal(slugify('foo  --  bar'), 'foo-bar');
});

test('slugify trims leading/trailing hyphens', () => {
  assert.equal(slugify('  --hello--  '), 'hello');
});

test('slugify throws on empty input', () => {
  assert.throws(() => slugify(''), /invalid prompt/i);
});

test('slugify throws on whitespace-only input', () => {
  assert.throws(() => slugify('   '), /invalid prompt/i);
});

test('buildSlug appends -industry suffix', () => {
  assert.equal(buildSlug('SaaS'), 'saas-industry');
});
