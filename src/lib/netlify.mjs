import archiver from 'archiver';

export async function zipDirectory(srcDir) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];
    archive.on('data', chunk => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    archive.directory(srcDir, false);
    archive.finalize();
  });
}

export async function createDeploy({ token, siteId, fetchImpl = globalThis.fetch }) {
  const res = await fetchImpl(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) throw new Error(`createDeploy failed: ${res.status}`);
  return await res.json();
}

export async function uploadDeployZip(deployId, zipBuffer, { token, fetchImpl = globalThis.fetch }) {
  const res = await fetchImpl(`https://api.netlify.com/api/v1/deploys/${deployId}/files`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/zip',
      'Content-Length': zipBuffer.length,
    },
    body: zipBuffer,
  });
  if (!res.ok) throw new Error(`uploadDeployZip failed: ${res.status}`);
  return await res.json();
}
