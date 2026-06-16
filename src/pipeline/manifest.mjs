import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const FILE = 'manifest.json';

export async function loadManifest(dataDir) {
  try {
    const raw = await readFile(join(dataDir, FILE), 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return { industries: [] };
    throw err;
  }
}

export async function saveManifest(dataDir, manifest) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, FILE), JSON.stringify(manifest, null, 2), 'utf-8');
}

export async function addToManifest(dataDir, entry) {
  const manifest = await loadManifest(dataDir);
  const filtered = manifest.industries.filter(i => i.slug !== entry.slug);
  filtered.unshift(entry);
  await saveManifest(dataDir, { industries: filtered });
}
