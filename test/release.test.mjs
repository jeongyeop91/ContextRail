import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { resolvePortableCommand } from '../src/adapters/process.mjs';
import { planExistingRepositoryAdoption } from '../src/core/adoption.mjs';

const execFile = promisify(execFileCallback);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FIXTURE = fileURLToPath(new URL('./fixtures/existing-repository/', import.meta.url));

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function execNpm(args, options) {
  const command = resolvePortableCommand('npm', args);
  return execFile(command.executable, command.args, options);
}

test('release version is consistent across package and generated metadata', async () => {
  const packageMetadata = await json(join(ROOT, 'package.json'));
  assert.equal(packageMetadata.version, '0.3.0-rc.3');
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

  const packed = await execNpm(['pack', '--json', '--pack-destination', artifacts], { cwd: ROOT, env });
  const manifest = JSON.parse(packed.stdout)[0];
  assert.ok(manifest.files.some((entry) => entry.path === 'bin/contextrail.mjs'));
  assert.equal(manifest.files.some((entry) => entry.path.startsWith('test/')), false);
  const tarball = join(artifacts, manifest.filename);

  await execNpm(['install', '--global', '--prefix', prefix, '--ignore-scripts', tarball], { env });
  const cliPath = process.platform === 'win32'
    ? join(prefix, 'node_modules/contextrail/bin/contextrail.mjs')
    : join(prefix, 'lib/node_modules/contextrail/bin/contextrail.mjs');
  const version = await execFile(process.execPath, [cliPath, '--version'], { env });
  assert.equal(version.stdout, '0.3.0-rc.3\n');
  const help = await execFile(process.execPath, [cliPath, '--help'], { env });
  assert.match(help.stdout, /^Usage:/);
  const target = join(temporary, 'Project With Spaces 한글');
  const setup = await execFile(process.execPath, [cliPath, 'setup', '--target', target, '--core-only', '--dry-run', '--json'], { env });
  const plan = JSON.parse(setup.stdout);
  assert.equal(plan.status, 'planned');
  assert.equal(plan.profile, 'core_only');
});
