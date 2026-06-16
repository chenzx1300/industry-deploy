import 'dotenv/config';
import { resolve } from 'node:path';
import { zipDirectory, createDeploy, uploadDeployZip } from './src/lib/netlify.mjs';

const { NETLIFY_TOKEN, NETLIFY_SITE_ID } = process.env;

if (!NETLIFY_TOKEN || !NETLIFY_SITE_ID) {
  console.error('Missing NETLIFY_TOKEN or NETLIFY_SITE_ID in .env');
  process.exit(1);
}

const DIST = resolve('dist');

async function main() {
  console.log('Zipping dist/...');
  const zip = await zipDirectory(DIST);
  console.log(`  → ${zip.length} bytes`);

  console.log('Creating deploy...');
  const deploy = await createDeploy({ token: NETLIFY_TOKEN, siteId: NETLIFY_SITE_ID });
  console.log(`  → deploy ${deploy.id} (${deploy.state})`);

  console.log('Uploading...');
  await uploadDeployZip(deploy.id, zip, { token: NETLIFY_TOKEN });
  console.log(`✓ Deployed: https://${NETLIFY_SITE_ID}.netlify.app`);
}

main().catch(err => {
  console.error('✗ Deploy failed:', err.message);
  console.error('Your dist/ is preserved. Run `node deploy.mjs` to retry.');
  process.exit(1);
});