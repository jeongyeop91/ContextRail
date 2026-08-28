import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync, gunzipSync } from 'node:zlib';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { assembleReleaseAssets } from '../scripts/build-release.mjs';
import { verifyReleaseEnvelope } from '../src/integrations/release-manifest.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-release-assets-'));
  const packageTarball = join(root, 'package-input.tgz');
  const throughlineArtifact = join(root, 'throughline-0.10.3-codex.2.tgz');
  const setupManifestPath = join(root, 'setup-manifest.json');
  const output = join(root, 'dist');
  const packagePayload = Buffer.from('exact ContextRail tar payload'.repeat(2048));
  const packageBytes = gzipSync(packagePayload, { level: 9 });
  const throughlinePayload = Buffer.from('exact patched Throughline tar payload'.repeat(2048));
  const throughlineBytes = gzipSync(throughlinePayload, { level: 0, mtime: 0 });
  throughlineBytes[9] = 255;
  const setupManifest = {
    schema: 1,
    releaseVersion: '0.3.0-rc.5',
    throughline: {
      packageVersion: '0.10.3-codex.2',
      artifact: {
        name: 'throughline-0.10.3-codex.2.tgz',
        url: 'https://github.com/jeongyeop91/ContextRail/releases/download/v0.3.0-rc.5/throughline-0.10.3-codex.2.tgz',
        sha256: sha256(throughlineBytes),
      },
    },
  };
  await writeFile(packageTarball, packageBytes);
  await writeFile(throughlineArtifact, throughlineBytes);
  await writeFile(setupManifestPath, `${JSON.stringify(setupManifest, null, 2)}\n`);
  return { root, output, packageTarball, throughlineArtifact, setupManifestPath, packageBytes, packagePayload, throughlineBytes, setupManifest };
}

test('assembles byte-identical registry and GitHub assets with a detached integrity envelope', async () => {
  const scope = await fixture();
  const result = await assembleReleaseAssets({
    output: scope.output,
    packageTarball: scope.packageTarball,
    throughlineArtifact: scope.throughlineArtifact,
    setupManifestPath: scope.setupManifestPath,
    packageMetadata: { name: 'contextrail', version: '0.3.0-rc.5' },
    fs: nodeFilesystem,
  });
  const names = (await nodeFilesystem.list(scope.output)).sort();
  assert.deepEqual(names, [
    'SHA256SUMS.txt',
    'contextrail-0.3.0-rc.5.tgz',
    'contextrail.tgz',
    'release-manifest.json',
    'throughline-0.10.3-codex.2.tgz',
  ]);
  const versionedBytes = await readFile(join(scope.output, 'contextrail-0.3.0-rc.5.tgz'));
  const stableBytes = await readFile(join(scope.output, 'contextrail.tgz'));
  assert.deepEqual(versionedBytes, stableBytes);
  assert.deepEqual(gunzipSync(versionedBytes), scope.packagePayload);
  assert.equal(versionedBytes[9], 255);
  const envelope = JSON.parse(await readFile(join(scope.output, 'release-manifest.json'), 'utf8'));
  const checksums = await readFile(join(scope.output, 'SHA256SUMS.txt'));
  assert.equal(checksums.toString().includes('release-manifest.json'), false);
  assert.equal(envelope.contextrail.sha256, sha256(versionedBytes));
  assert.equal(envelope.setupManifestSha256, sha256(await readFile(scope.setupManifestPath)));
  assert.equal(envelope.checksumsSha256, sha256(checksums));
  assert.equal(verifyReleaseEnvelope({
    manifest: envelope,
    setupManifestBytes: await readFile(scope.setupManifestPath),
    checksumsBytes: checksums,
    contextrailSha256: sha256(versionedBytes),
    throughlineSha256: sha256(scope.throughlineBytes),
  }).ok, true);
  assert.equal(result.releaseVersion, '0.3.0-rc.5');
});

test('refuses a Throughline input that differs from the embedded setup manifest', async () => {
  const scope = await fixture();
  await writeFile(scope.throughlineArtifact, 'changed');
  await assert.rejects(assembleReleaseAssets({
    output: scope.output,
    packageTarball: scope.packageTarball,
    throughlineArtifact: scope.throughlineArtifact,
    setupManifestPath: scope.setupManifestPath,
    packageMetadata: { name: 'contextrail', version: '0.3.0-rc.5' },
    fs: nodeFilesystem,
  }), /Throughline artifact digest mismatch/);
  assert.equal(await nodeFilesystem.exists(scope.output), false);
});
