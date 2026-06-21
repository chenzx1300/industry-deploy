import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { buildSlug } from './pipeline/slugify.mjs';
import { searchIndustry } from './pipeline/search.mjs';
import { identifyCompanies } from './pipeline/identify.mjs';
import { fetchNewsForCompanies } from './pipeline/fetch-news.mjs';
import { renderIndustryPage, renderHomepage } from './pipeline/render.mjs';
import { addToManifest, loadManifest } from './pipeline/manifest.mjs';
import { validateData } from './pipeline/validate.mjs';
import { step, ok, fail } from './lib/logger.mjs';

const ROOT = resolve('.');
const DATA_DIR = join(ROOT, 'data');
const OUT_DIR = join(ROOT, 'docs');

async function main() {
  const prompt = process.argv[2];
  if (!prompt) {
    fail('Usage: npm run build -- "<industry prompt>"');
    process.exit(1);
  }

  let slug, data;

  try {
    step(1, 7, 'slugify', prompt);
    slug = buildSlug(prompt);
    ok(slug);

    step(2, 7, 'tavily search');
    const tavilyResults = await searchIndustry(prompt, { apiKey: process.env.TAVILY_API_KEY });
    ok(`${tavilyResults.results.length} results`);

    step(3, 7, 'claude identify');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const identified = await identifyCompanies(prompt, tavilyResults, { client });
    const companies = identified.companies;
    ok(`${companies.length} companies (${companies.filter(c => c.region === 'cn').length} CN + ${companies.filter(c => c.region === 'intl').length} Intl)`);

    step(4, 7, 'fetch news');
    const withNews = await fetchNewsForCompanies(companies.map(c => ({ ...c, id: c.slug })));
    const totalNews = withNews.reduce((s, c) => s + c.news.length, 0);
    ok(`${totalNews} items across 6 companies`);

    step(5, 7, 'normalize & validate');
    data = {
      slug,
      prompt,
      generated_at: new Date().toISOString(),
      companies: withNews,
    };
    const validation = validateData(data);
    if (!validation.ok) throw new Error(`validation: ${validation.error}`);
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(join(DATA_DIR, `${slug}.json`), JSON.stringify(data, null, 2));
    ok(`data/${slug}.json`);

    step(6, 7, 'render');
    const companyCount = data.companies.length;
    const newsCount = data.companies.reduce((s, c) => s + c.news.length, 0);
    await addToManifest(DATA_DIR, {
      slug,
      prompt,
      company_count: companyCount,
      news_count: newsCount,
      generated_at: data.generated_at,
    });
    const manifest = await loadManifest(DATA_DIR);

    const industryHtml = renderIndustryPage(data);
    const homepageHtml = renderHomepage(manifest);

    await mkdir(join(OUT_DIR, slug), { recursive: true });
    await writeFile(join(OUT_DIR, slug, 'index.html'), industryHtml);
    await writeFile(join(OUT_DIR, 'index.html'), homepageHtml);
    ok('docs/index.html + docs/' + slug + '/index.html');

    step(7, 7, 'done');
    ok(`Commit docs/ and push to GitHub. Enable Pages in repo settings → Source: master → /docs.`);
    if (process.env.GITHUB_PAGES_URL) {
      ok(`URL: ${process.env.GITHUB_PAGES_URL}/${slug}/`);
    }
  } catch (err) {
    fail(err.message);
    if (data) {
      console.error(`Data saved at data/${slug}.json`);
      console.error(`Resume with: node src/pipeline/render.mjs ${slug}`);
    }
    process.exit(1);
  }
}

main();
