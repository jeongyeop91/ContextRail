import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { planExistingRepositoryAdoption } from '../src/core/adoption.mjs';

const execFile = promisify(execFileCallback);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FIXTURE = new URL('./fixtures/existing-repository/', import.meta.url).pathname;

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('release version is consistent across package and generated metadata', async () => {
  const packageMetadata = await json(join(ROOT, 'package.json'));
  assert.equal(packageMetadata.version, '0.1.0');
  assert.equal((await json(join(ROOT, '.context-rail/version.json'))).templateVersion, packageMetadata.version);
  assert.equal((await json(join(ROOT, 'templates/project/.context-rail/version.json'))).templateVersion, packageMetadata.version);

  const target = await mkdtemp(join(tmpdir(), 'contextrail-release-adoption-'));
  await cp(FIXTURE, target, { recursive: true });
  const config = await json(join(target, 'adoption-config.json'));
  const plan = await planExistingRepositoryAdoption({ target, config, fs: nodeFilesystem });
  const versionOperation = plan.operations.find((entry) => entry.path === '.context-rail/version.json');
  assert.equal(JSON.parse(versionOperation.content).templateVersion, packageMetadata.version);
});

test('packed CLI installs into an isolated prefix and runs version and help', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'contextrail-package-smoke-'));
  const artifacts = join(temporary, 'artifacts');
  const prefix = join(temporary, 'prefix');
  const home = join(temporary, 'home');
  const cache = join(temporary, 'npm-cache');
  await Promise.all([artifacts, prefix, home, cache].map((path) => mkdir(path, { recursive: true })));
  const env = { ...process.env, HOME: home, npm_config_cache: cache };

  const packed = await execFile('npm', ['pack', '--json', '--pack-destination', artifacts], { cwd: ROOT, env });
  const manifest = JSON.parse(packed.stdout)[0];
  assert.ok(manifest.files.some((entry) => entry.path === 'bin/contextrail.mjs'));
  assert.equal(manifest.files.some((entry) => entry.path.startsWith('test/')), false);
  const tarball = join(artifacts, manifest.filename);

  await execFile('npm', ['install', '--global', '--prefix', prefix, '--ignore-scripts', tarball], { env });
  const binary = join(prefix, 'bin/contextrail');
  const version = await execFile(binary, ['--version'], { env });
  assert.equal(version.stdout, '0.1.0\n');
  const help = await execFile(binary, ['--help'], { env });
  assert.match(help.stdout, /^Usage:/);
});
