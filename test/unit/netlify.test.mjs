import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipDirectory, createDeploy, uploadDeployZip } from '../../src/lib/netlify.mjs';

test('zipDirectory returns a Buffer', async () => {
  const zip = await zipDirectory('test/fixtures', null);
  assert.ok(Buffer.isBuffer(zip));
  assert.ok(zip.length > 0);
});

test('createDeploy POSTs to deploys endpoint', async () => {
  let captured;
  const mockFetch = async (url, opts) => {
    captured = { url, opts };
    return { ok: true, status: 201, json: async () => ({ id: 'dep_123', state: 'created' }) };
  };
  const result = await createDeploy({ token: 'tkn', siteId: 'sid', fetchImpl: mockFetch });
  assert.equal(result.id, 'dep_123');
  assert.match(captured.url, /\/sites\/sid\/deploys$/);
  assert.match(captured.opts.headers.Authorization, /Bearer tkn/);
});

test('uploadDeployZip PUTs zip to files endpoint', async () => {
  let captured;
  const mockFetch = async (url, opts) => {
    captured = { url, opts };
    return { ok: true, status: 200, json: async () => ({ state: 'uploaded' }) };
  };
  const buf = Buffer.from('PK fake zip');
  await uploadDeployZip('dep_123', buf, { token: 'tkn', fetchImpl: mockFetch });
  assert.match(captured.url, /\/deploys\/dep_123\/files$/);
  assert.equal(captured.opts.headers['Content-Type'], 'application/zip');
});
