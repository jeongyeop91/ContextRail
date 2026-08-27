import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync, gunzipSync } from 'node:zlib';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { buildThroughlineArtifact } from '../scripts/build-throughline.mjs';

test('copies only the prepared pinned Throughline tarball to the requested output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-build-throughline-'));
  const prepared = join(root, 'prepared', 'throughline-0.10.3-codex.1.tgz');
  const output = join(root, 'release-inputs', 'throughline-0.10.3-codex.1.tgz');
  const payload = Buffer.from('prepared Throughline tar payload'.repeat(2048));
  await nodeFilesystem.mkdir(join(root, 'prepared'), { recursive: true });
  await writeFile(prepared, gzipSync(payload, { level: 9 }));
  const result = await buildThroughlineArtifact({
    root,
    output,
    fs: nodeFilesystem,
    prepare: async () => ({ artifact: prepared, evidence: { steps: ['clone', 'checkout', 'verify_head', 'check_patch', 'apply_patch', 'test', 'pack'] } }),
  });
  const outputBytes = await readFile(output);
  assert.deepEqual(gunzipSync(outputBytes), payload);
  assert.equal(outputBytes[9], 255);
  assert.equal(result.output, output);
  assert.equal(result.evidence.steps.at(-1), 'pack');
});
