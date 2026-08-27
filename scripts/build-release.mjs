import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { nodeProcess } from '../src/adapters/process.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT_PATH), '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function copyBytes(from, to, fs) {
  await fs.writeBytes(to, await fs.readBytes(from));
}

export async function assembleReleaseAssets({
  output,
  packageTarball,
  throughlineArtifact,
  setupManifestPath,
  packageMetadata,
  fs = nodeFilesystem,
}) {
  if (packageMetadata.name !== 'contextrail') throw new Error('Release package name must be contextrail');
  const setupBytes = await fs.readBytes(setupManifestPath);
  const setupManifest = JSON.parse(setupBytes.toString('utf8'));
  if (setupManifest.releaseVersion !== packageMetadata.version) throw new Error('Setup manifest release version differs from package version');
  const throughlineBytes = await fs.readBytes(throughlineArtifact);
  const throughlineSha256 = sha256(throughlineBytes);
  if (throughlineSha256 !== setupManifest.throughline?.artifact?.sha256) throw new Error('Throughline artifact digest mismatch with embedded setup manifest');
  if (basename(throughlineArtifact) !== setupManifest.throughline.artifact.name) throw new Error('Throughline artifact name differs from embedded setup manifest');
  const packageBytes = await fs.readBytes(packageTarball);
  const packageSha256 = sha256(packageBytes);
  const destination = resolve(output);
  if (await fs.exists(destination)) throw new Error(`Release output already exists: ${destination}`);
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`;
  const versionedAsset = `contextrail-${packageMetadata.version}.tgz`;
  const stableAsset = 'contextrail.tgz';
  const throughlineName = setupManifest.throughline.artifact.name;
  try {
    await fs.mkdir(temporary, { recursive: true });
    await copyBytes(packageTarball, resolve(temporary, versionedAsset), fs);
    await copyBytes(packageTarball, resolve(temporary, stableAsset), fs);
    await copyBytes(throughlineArtifact, resolve(temporary, throughlineName), fs);
    const checksums = [
      [packageSha256, stableAsset],
      [packageSha256, versionedAsset],
      [throughlineSha256, throughlineName],
    ].sort((left, right) => left[1].localeCompare(right[1])).map(([digest, name]) => `${digest}  ${name}`).join('\n') + '\n';
    const checksumsBytes = Buffer.from(checksums);
    await fs.writeBytes(resolve(temporary, 'SHA256SUMS.txt'), checksumsBytes);
    const envelope = {
      schema: 1,
      releaseVersion: packageMetadata.version,
      sourceTag: `v${packageMetadata.version}`,
      setupManifestSha256: sha256(setupBytes),
      checksumsSha256: sha256(checksumsBytes),
      contextrail: {
        sha256: packageSha256,
        versionedAsset,
        stableAsset,
        npmPackage: `contextrail@${packageMetadata.version}`,
      },
      throughline: structuredClone(setupManifest.throughline.artifact),
    };
    await fs.writeText(resolve(temporary, 'release-manifest.json'), `${JSON.stringify(envelope, null, 2)}\n`);
    await fs.rename(temporary, destination);
    return { output: destination, releaseVersion: packageMetadata.version, contextrailSha256: packageSha256, throughlineSha256 };
  } catch (error) {
    await fs.remove(temporary, { recursive: true, force: true });
    throw error;
  }
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

export async function buildRelease({ output, throughlineArtifact, fs = nodeFilesystem, processAdapter = nodeProcess }) {
  const temporary = await mkdtemp(resolve(tmpdir(), 'contextrail-release-build-'));
  try {
    const packed = await processAdapter.run('npm', ['pack', '--json', '--pack-destination', temporary], { cwd: ROOT, timeoutMs: 120000 });
    if (packed.code !== 0) throw new Error(`npm pack failed: ${packed.stderr}`);
    const metadata = JSON.parse(packed.stdout)[0];
    const packageMetadata = JSON.parse(await fs.readText(resolve(ROOT, 'package.json')));
    return await assembleReleaseAssets({
      output,
      packageTarball: resolve(temporary, metadata.filename),
      throughlineArtifact,
      setupManifestPath: resolve(ROOT, 'integrations/setup-manifest.json'),
      packageMetadata,
      fs,
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SCRIPT_PATH)) {
  const output = option(process.argv.slice(2), '--output');
  const throughlineArtifact = option(process.argv.slice(2), '--throughline-artifact');
  if (!output || !throughlineArtifact) {
    process.stderr.write('Usage: node scripts/build-release.mjs --output PATH --throughline-artifact FILE\n');
    process.exitCode = 2;
  } else {
    try {
      process.stdout.write(`${JSON.stringify(await buildRelease({ output: resolve(output), throughlineArtifact: resolve(throughlineArtifact) }), null, 2)}\n`);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

