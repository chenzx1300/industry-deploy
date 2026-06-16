import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step, ok, fail, info } from '../../src/lib/logger.mjs';

test('step formats with phase number', () => {
  const captured = [];
  const orig = console.log;
  console.log = (msg) => captured.push(msg);
  try {
    step(1, 7, 'slugify', 'foo');
  } finally {
    console.log = orig;
  }
  assert.equal(captured.length, 1);
  assert.match(captured[0], /\[1\/7\] slugify/);
});

test('ok and fail use symbols', () => {
  const captured = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (msg) => captured.push(['log', msg]);
  console.error = (msg) => captured.push(['err', msg]);
  try {
    ok('done');
    fail('oops');
    info('note');
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  assert.equal(captured.length, 3);
  assert.equal(captured[0][0], 'log');
  assert.match(captured[0][1], /✓ done/);
  assert.equal(captured[1][0], 'err');
  assert.match(captured[1][1], /✗ oops/);
  assert.equal(captured[2][0], 'log');
  assert.match(captured[2][1], /note/);
});