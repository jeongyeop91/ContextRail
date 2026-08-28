import assert from 'node:assert/strict';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { loadSetupManifest, selectThroughlineArtifact, validateSetupManifest } from '../src/integrations/setup-manifest.mjs';

const valid = {
  schema: 1,
  releaseVersion: '0.3.0-rc.5',
  nodeVersion: '>=22.13',
  platforms: ['darwin', 'linux', 'win32'],
  throughline: {
    packageVersion: '0.10.3-codex.2',
    repository: 'https://github.com/kitepon/Throughline.git',
    baseCommit: '4bf84f548eeb7173a3b46be33b9b0c54723ab21f',
    compatibilityCommit: 'd5ff84cd698511e0375d17721f41b4b86bbe37c6',
    patchSha256: '8'.repeat(64),
    removalCondition: 'Remove after an immutable upstream release passes equivalent capture verification.',
    artifact: {
      name: 'throughline-0.10.3-codex.2.tgz',
      url: 'https://github.com/jeongyeop91/ContextRail/releases/download/v0.3.0-rc.5/throughline-0.10.3-codex.2.tgz',
      sha256: 'a'.repeat(64),
    },
  },
};

test('accepts an immutable setup manifest and selects only Throughline', () => {
  const result = validateSetupManifest(valid, { expectedVersion: '0.3.0-rc.5' });
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
  const result = validateSetupManifest(input, { expectedVersion: '0.3.0-rc.5' });
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
  const result = await loadSetupManifest({ root: process.cwd(), fs: nodeFilesystem, expectedVersion: '0.3.0-rc.5' });
  assert.equal(result.ok, true);
  assert.equal(result.manifest.throughline.patchSha256, '15b6a263ec6861c2d7b1b439471e131b10b8c8eba62fab2b6ec00d4e9d9fb8e4');
  assert.equal(result.manifest.throughline.artifact.sha256, '29053de08c4ec074c2e02f724314f91e7359a48fb79f7feadaceb7de7f594fd9');
});
