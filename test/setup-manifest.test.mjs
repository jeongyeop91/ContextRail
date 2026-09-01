import assert from 'node:assert/strict';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { loadSetupManifest, selectThroughlineArtifact, validateSetupManifest } from '../src/integrations/setup-manifest.mjs';

const valid = {
  schema: 1,
  releaseVersion: '0.3.0-rc.11',
  nodeVersion: '>=22.13',
  platforms: ['darwin', 'linux', 'win32'],
  throughline: {
    packageVersion: '0.10.3-codex.4',
    repository: 'https://github.com/kitepon/Throughline.git',
    baseCommit: '4bf84f548eeb7173a3b46be33b9b0c54723ab21f',
    compatibilityCommit: 'fb930dd13dd9bd48759217a955298b010867d948',
    patchSha256: '8'.repeat(64),
    removalCondition: 'Remove after an immutable upstream release passes equivalent capture verification.',
    artifact: {
      name: 'throughline-0.10.3-codex.4.tgz',
      url: 'https://github.com/jeongyeop91/ContextRail/releases/download/v0.3.0-rc.11/throughline-0.10.3-codex.4.tgz',
      sha256: 'a'.repeat(64),
    },
  },
};

test('accepts an immutable setup manifest and selects only Throughline', () => {
  const result = validateSetupManifest(valid, { expectedVersion: '0.3.0-rc.11' });
  assert.equal(result.ok, true);
  assert.deepEqual(selectThroughlineArtifact(result.manifest), valid.throughline.artifact);
  assert.equal(JSON.stringify(result.manifest).includes('contextrailSha256'), false);
});

test('rejects mutable assets, malformed digests, unknown platforms, version drift, and unknown keys', () => {
  const input = structuredClone(valid);
  input.releaseVersion = '0.3.0-rc.2';
  input.platforms.push('aix');
  input.throughline.artifact.url = 'https://github.com/jeongyeop91/ContextRail/releases/latest/download/throughline.tgz';
  input.throughline.artifact.sha256 = 'bad';
  input.extra = true;
  const result = validateSetupManifest(input, { expectedVersion: '0.3.0-rc.11' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map(({ code }) => code), [
    'INVALID_SETUP_PLATFORM',
    'INVALID_THROUGHLINE_ARTIFACT_SHA256',
    'MUTABLE_THROUGHLINE_ARTIFACT_URL',
    'SETUP_RELEASE_VERSION_MISMATCH',
    'UNKNOWN_SETUP_MANIFEST_KEY',
  ]);
});

test('loads the checked-in release-candidate selection with matching Throughline provenance', async () => {
  const result = await loadSetupManifest({ root: process.cwd(), fs: nodeFilesystem, expectedVersion: '0.3.0-rc.11' });
  assert.equal(result.ok, true);
  assert.equal(result.manifest.throughline.patchSha256, '7fa56a91c0180f03e391b7ebe51ec4bc977a09dae30d6bf9e3d956783b6197f3');
  assert.equal(result.manifest.throughline.artifact.sha256, '96c8d8f5395d319ce3569cad7c228f18782cc8d9331a2860043f4da31d057ea1');
});
