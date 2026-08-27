import { createHash } from 'node:crypto';
import { get } from 'node:https';
import { dirname, resolve } from 'node:path';

import { nodeFilesystem } from './filesystem.mjs';

const DOWNLOAD_HOSTS = new Set(['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com']);
const MAX_BYTES = 256 * 1024 * 1024;

function request(url) {
  return new Promise((resolveRequest, reject) => {
    const operation = get(url, (response) => resolveRequest({
      statusCode: response.statusCode,
      headers: response.headers,
      body: response,
    }));
    operation.on('error', reject);
  });
}

export const nodeReleaseHttp = { open: request };

function immutableGitHubReleaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'github.com'
      && /\/releases\/download\/v[^/]+\/[^/]+$/.test(url.pathname)
      && !url.pathname.includes('/latest/');
  } catch {
    return false;
  }
}

function allowedRedirect(value, base) {
  const url = new URL(value, base);
  if (url.protocol !== 'https:' || !DOWNLOAD_HOSTS.has(url.hostname)) throw new Error(`Release redirect host is not allowed: ${url.hostname}`);
  return url.toString();
}

async function openWithRedirects(url, http) {
  let selected = url;
  for (let count = 0; count <= 3; count += 1) {
    const response = await http.open(selected);
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      if (!response.headers?.location) throw new Error('Release redirect has no location');
      selected = allowedRedirect(response.headers.location, selected);
      continue;
    }
    if (response.statusCode !== 200) throw new Error(`Release download failed with HTTP ${response.statusCode}`);
    return response;
  }
  throw new Error('Release download exceeded redirect limit');
}

export async function downloadVerifiedArtifact({ artifact, destination, http = nodeReleaseHttp, fs = nodeFilesystem }) {
  if (!immutableGitHubReleaseUrl(artifact?.url)) throw new Error('Artifact must use an immutable GitHub Release URL');
  if (!/^[a-f\d]{64}$/.test(artifact?.sha256 ?? '')) throw new Error('Artifact SHA-256 is invalid');
  const output = resolve(destination);
  if (await fs.exists(output)) throw new Error(`Release destination already exists: ${output}`);
  const temporary = `${output}.part-${process.pid}-${Date.now()}`;
  try {
    const response = await openWithRedirects(artifact.url, http);
    const hash = createHash('sha256');
    const chunks = [];
    let bytes = 0;
    for await (const value of response.body) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      bytes += chunk.length;
      if (bytes > MAX_BYTES) throw new Error('Release artifact exceeds the download size limit');
      hash.update(chunk);
      chunks.push(chunk);
    }
    const sha256 = hash.digest('hex');
    if (sha256 !== artifact.sha256) throw new Error(`Release artifact digest mismatch: expected ${artifact.sha256}, received ${sha256}`);
    await fs.mkdir(dirname(output), { recursive: true });
    await fs.writeBytes(temporary, Buffer.concat(chunks));
    await fs.rename(temporary, output);
    return { path: output, sha256, bytes };
  } catch (error) {
    await fs.remove(temporary, { force: true });
    throw error;
  }
}
