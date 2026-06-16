const TOOL = {
  name: 'return_companies',
  description: 'Return exactly 6 companies ranked by influence/market cap, 3 Chinese + 3 international.',
  input_schema: {
    type: 'object',
    properties: {
      companies: {
        type: 'array',
        minItems: 6,
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            region: { type: 'string', enum: ['cn', 'intl'] },
            domain: { type: 'string' },
            slug: { type: 'string' },
          },
          required: ['name', 'region', 'domain', 'slug'],
        },
      },
    },
    required: ['companies'],
  },
};

const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export async function identifyCompanies(prompt, tavilyResults, { client, model = 'claude-sonnet-4-6', maxRetries = 1 } = {}) {
  const tavilySummary = tavilyResults.results
    .map(r => `- ${r.title}: ${r.content}`)
    .join('\n');

  const userMsg = `Industry prompt: "${prompt}"\n\nWeb search results:\n${tavilySummary}\n\nReturn exactly 6 companies ranked by influence/market cap: 3 Chinese ("region": "cn") + 3 international ("region": "intl"). For each, give official domain (no www.). For Chinese prompts, also include "slug_en" (lowercase, hyphenated English).`;

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'return_companies' },
        messages: [{ role: 'user', content: userMsg }],
      });

      const toolUse = response.content.find(c => c.type === 'tool_use' && c.name === 'return_companies');
      if (!toolUse) throw new Error('no tool use in response');
      const parsed = toolUse.input;

      if (!parsed.companies || parsed.companies.length !== 6) {
        throw new Error('expected 6 companies');
      }
      const valid = parsed.companies.filter(c => DOMAIN_RE.test(c.domain));
      return { companies: valid };
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }
  throw lastErr;
}