import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { buildThroughlineArtifact } from '../scripts/build-throughline.mjs';

test('copies only the prepared pinned Throughline tarball to the requested output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-build-throughline-'));
  const prepared = join(root, 'prepared', 'throughline-0.10.3-codex.1.tgz');
  const output = join(root, 'release-inputs', 'throughline-0.10.3-codex.1.tgz');
  await nodeFilesystem.mkdir(join(root, 'prepared'), { recursive: true });
  await writeFile(prepared, 'prepared bytes');
  const result = await buildThroughlineArtifact({
    root,
    output,
    fs: nodeFilesystem,
    prepare: async () => ({ artifact: prepared, evidence: { steps: ['clone', 'checkout', 'verify_head', 'check_patch', 'apply_patch', 'test', 'pack'] } }),
  });
  assert.equal(await readFile(output, 'utf8'), 'prepared bytes');
  assert.equal(result.output, output);
  assert.equal(result.evidence.steps.at(-1), 'pack');
});

