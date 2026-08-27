import assert from 'node:assert/strict';
import test from 'node:test';

import { validateReleaseManifest, verifyReleaseEnvelope } from '../src/integrations/release-manifest.mjs';

const setupBytes = Buffer.from('{"schema":1}\n');
const checksumsBytes = Buffer.from('synthetic checksums\n');

const valid = {
  schema: 1,
  releaseVersion: '0.3.0-rc.2',
  sourceTag: 'v0.3.0-rc.2',
  setupManifestSha256: '6b823fa123b900a4139de2101277275af8329f3a3d34c00ef3bf4fc6bf60287e',
  checksumsSha256: '4a8cc1cb5450c51060d5e5868bd2573ab8714ce9c08d224ef2e378f47693b414',
  contextrail: {
    sha256: 'b'.repeat(64),
    versionedAsset: 'contextrail-0.3.0-rc.2.tgz',
    stableAsset: 'contextrail.tgz',
    npmPackage: 'contextrail@0.3.0-rc.2',
  },
  throughline: {
    name: 'throughline-0.10.3-codex.1.tgz',
    url: 'https://github.com/jeongyeop91/ContextRail/releases/download/v0.3.0-rc.2/throughline-0.10.3-codex.1.tgz',
    sha256: 'a'.repeat(64),
  },
};

test('validates a detached envelope without a ContextRail self-reference', () => {
  const result = validateReleaseManifest(valid);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(result.manifest).includes('release-manifest.json'), false);
});

test('binds final artifacts and embedded manifest to the detached envelope', () => {
  const result = verifyReleaseEnvelope({
    manifest: valid,
    setupManifestBytes: setupBytes,
    checksumsBytes,
    contextrailSha256: 'b'.repeat(64),
    throughlineSha256: 'a'.repeat(64),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);

  const mismatch = verifyReleaseEnvelope({
    manifest: valid,
    setupManifestBytes: Buffer.from('changed'),
    checksumsBytes,
    contextrailSha256: 'c'.repeat(64),
    throughlineSha256: 'd'.repeat(64),
  });
  assert.deepEqual(mismatch.issues.map(({ code }) => code), [
    'CONTEXT_RAIL_ARTIFACT_DIGEST_MISMATCH',
    'SETUP_MANIFEST_DIGEST_MISMATCH',
    'THROUGHLINE_ARTIFACT_DIGEST_MISMATCH',
  ]);
});
