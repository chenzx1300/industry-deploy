import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { identifyCompanies } from '../../src/pipeline/identify.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tavilyFixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/tavily-results.json'), 'utf-8'));

function sixCompanies() {
  return {
    companies: [
      { name: 'BYD', region: 'cn', domain: 'byd.com', slug: 'byd' },
      { name: 'CATL', region: 'cn', domain: 'catl.com', slug: 'catl' },
      { name: 'NIO', region: 'cn', domain: 'nio.com', slug: 'nio' },
      { name: 'Tesla', region: 'intl', domain: 'tesla.com', slug: 'tesla' },
      { name: 'Volkswagen', region: 'intl', domain: 'volkswagen.com', slug: 'vw' },
      { name: 'Toyota', region: 'intl', domain: 'toyota.com', slug: 'toyota' },
    ]
  };
}

test('identifyCompanies calls Claude with structured prompt', async () => {
  let captured;
  const client = {
    messages: {
      create: async (params) => {
        captured = params;
        return { content: [{ type: 'tool_use', name: 'return_companies', input: sixCompanies() }] };
      },
    },
  };
  await identifyCompanies('new energy vehicles', tavilyFixture, { client });
  assert.match(captured.messages[0].content, /new energy vehicles/i);
  assert.match(captured.messages[0].content, /BYD, CATL, NIO/);
  assert.equal(captured.tools[0].name, 'return_companies');
});

test('identifyCompanies preserves LLM ranking', async () => {
  const reordered = sixCompanies();
  reordered.companies = [
    reordered.companies[3], reordered.companies[0],
    reordered.companies[1], reordered.companies[2],
    reordered.companies[5], reordered.companies[4],
  ];
  const client = {
    messages: {
      create: async () => ({ content: [{ type: 'tool_use', name: 'return_companies', input: reordered }] }),
    },
  };
  const result = await identifyCompanies('ev', tavilyFixture, { client });
  assert.equal(result.companies[0].name, 'Tesla');
});

test('identifyCompanies filters invalid domains', async () => {
  const data = sixCompanies();
  data.companies[0].domain = 'not-a-domain';
  const client = {
    messages: {
      create: async () => ({ content: [{ type: 'tool_use', name: 'return_companies', input: data }] }),
    },
  };
  const result = await identifyCompanies('ev', tavilyFixture, { client });
  assert.equal(result.companies.length, 5);
  assert(!result.companies.find(c => c.domain === 'not-a-domain'));
});

test('identifyCompanies throws on no tool_use', async () => {
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: 'nope' }] }) } };
  await assert.rejects(() => identifyCompanies('ev', tavilyFixture, { client }), /tool_use|no tool use/i);
});

test('identifyCompanies throws when not 6 companies', async () => {
  const client = {
    messages: {
      create: async () => ({
        content: [{ type: 'tool_use', name: 'return_companies', input: { companies: [{ name: 'BYD', region: 'cn', domain: 'byd.com', slug: 'byd' }] } }],
      }),
    },
  };
  await assert.rejects(() => identifyCompanies('ev', tavilyFixture, { client }), /6 companies/i);
});