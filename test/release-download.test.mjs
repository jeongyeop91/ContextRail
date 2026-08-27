import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { downloadVerifiedArtifact } from '../src/adapters/release.mjs';

const bytes = Buffer.from('verified artifact');
const digest = createHash('sha256').update(bytes).digest('hex');

function response(body = bytes) {
  return { statusCode: 200, headers: {}, body: [body] };
}

test('downloads an immutable GitHub release asset and verifies its digest before selection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-release-download-'));
  const destination = join(root, 'artifact with spaces.tgz');
  const artifact = {
    url: 'https://github.com/jeongyeop91/ContextRail/releases/download/v0.3.0-rc.1/artifact.tgz',
    sha256: digest,
  };
  const result = await downloadVerifiedArtifact({ artifact, destination, http: { open: async () => response() }, fs: nodeFilesystem });
  assert.deepEqual(await nodeFilesystem.readBytes(destination), bytes);
  assert.deepEqual(result, { path: destination, sha256: digest, bytes: bytes.length });
});

test('rejects a bad digest and removes partial output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-release-download-'));
  const destination = join(root, 'artifact.tgz');
  const artifact = {
    url: 'https://github.com/jeongyeop91/ContextRail/releases/download/v0.3.0-rc.1/artifact.tgz',
    sha256: '0'.repeat(64),
  };
  await assert.rejects(
    downloadVerifiedArtifact({ artifact, destination, http: { open: async () => response() }, fs: nodeFilesystem }),
    /digest mismatch/i,
  );
  assert.equal(await nodeFilesystem.exists(destination), false);
});

test('rejects latest URLs and redirects outside approved GitHub hosts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-release-download-'));
  const destination = join(root, 'artifact.tgz');
  await assert.rejects(
    downloadVerifiedArtifact({
      artifact: { url: 'https://github.com/example/project/releases/latest/download/artifact.tgz', sha256: digest },
      destination,
      http: { open: async () => response() },
      fs: nodeFilesystem,
    }),
    /immutable GitHub Release URL/,
  );
  await assert.rejects(
    downloadVerifiedArtifact({
      artifact: { url: 'https://github.com/example/project/releases/download/v1/artifact.tgz', sha256: digest },
      destination,
      http: { open: async () => ({ statusCode: 302, headers: { location: 'https://example.com/artifact.tgz' }, body: [] }) },
      fs: nodeFilesystem,
    }),
    /redirect host/,
  );
});

