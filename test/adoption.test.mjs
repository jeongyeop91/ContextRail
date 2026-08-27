import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { applyScaffold } from '../src/core/scaffold.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/existing-repository/', import.meta.url));
const MANAGED_PATHS = ['.context-rail/.gitignore', '.context-rail/config.json', '.context-rail/version.json'];
const FORBIDDEN_PATHS = [
  'AGENTS.md',
  'docs/README.md',
  'docs/authority/PROJECT.md',
  'state/CURRENT.md',
  'state/PLAN.md',
  'state/BACKLOG.json',
  'docs/engineering/STATUS.md',
  'backlog/work.yaml',
];

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function loadAdoptionModule() {
  const module = await import('../src/core/adoption.mjs').catch(() => null);
  assert.ok(module, 'existing-repository adoption module must exist');
  return module;
}

async function fixtureCopy() {
  const target = await mkdtemp(join(tmpdir(), 'contextrail-existing-'));
  await cp(FIXTURE, target, { recursive: true });
  return target;
}

async function config() {
  return JSON.parse(await readFile(join(FIXTURE, 'adoption-config.json'), 'utf8'));
}

test('existing-repository dry-run plans only three managed metadata files', async () => {
  const { planExistingRepositoryAdoption } = await loadAdoptionModule();
  const target = await fixtureCopy();
  const plan = await planExistingRepositoryAdoption({ target, config: await config(), fs: nodeFilesystem });

  assert.equal(plan.ok, true, JSON.stringify(plan.issues));
  assert.deepEqual(plan.operations.map((entry) => entry.path).sort(), MANAGED_PATHS);
  assert.ok(plan.operations.every((entry) => entry.action === 'create' && /^[a-f\d]{64}$/.test(entry.contentHash)));
  assert.ok(FORBIDDEN_PATHS.every((path) => !plan.operations.some((entry) => entry.path === path)));
  assert.equal(await nodeFilesystem.exists(join(target, '.context-rail')), false);
});

test('adoption config rejects mismatched profiles, unsafe paths, and shell strings', async () => {
  const { normalizeAdoptionConfig } = await loadAdoptionModule();
  const base = await config();
  const cases = [
    [{ ...base, schema: 2 }, 'INVALID_ADOPTION_SCHEMA'],
    [{ ...base, profile: 'native' }, 'INVALID_ADOPTION_PROFILE'],
    [{ ...base, documentRouter: '../README.md' }, 'ADOPTION_PATH_ESCAPE'],
    [{ ...base, state: { ...base.state, backlog: '/tmp/backlog.yaml' } }, 'INVALID_ADOPTION_PATH'],
    [{ ...base, state: { ...base.state, backlog: 'C:\\temp\\backlog.yaml' } }, 'INVALID_ADOPTION_PATH'],
    [{ ...base, validationHints: ['node --test'] }, 'INVALID_VALIDATION_HINTS'],
  ];
  for (const [value, code] of cases) {
    const result = normalizeAdoptionConfig(value);
    assert.equal(result.ok, false, code);
    assert.ok(result.issues.some((entry) => entry.code === code), JSON.stringify(result.issues));
  }
});

test('existing different ContextRail config is a conflict and is not overwritten', async () => {
  const { planExistingRepositoryAdoption } = await loadAdoptionModule();
  const target = await fixtureCopy();
  await mkdir(join(target, '.context-rail'), { recursive: true });
  await writeFile(join(target, '.context-rail/config.json'), '{"profile":"different"}\n');
  const plan = await planExistingRepositoryAdoption({ target, config: await config(), fs: nodeFilesystem });

  assert.equal(plan.ok, false);
  assert.equal(plan.operations.find((entry) => entry.path === '.context-rail/config.json').action, 'conflict');
  assert.equal(await readFile(join(target, '.context-rail/config.json'), 'utf8'), '{"profile":"different"}\n');
});

test('apply creates exact metadata and owns no project files', async () => {
  const { planExistingRepositoryAdoption } = await loadAdoptionModule();
  const target = await fixtureCopy();
  const plan = await planExistingRepositoryAdoption({ target, config: await config(), fs: nodeFilesystem });
  const beforeAgent = await readFile(join(target, 'AGENTS.md'), 'utf8');
  const beforeRouter = await readFile(join(target, 'docs/README.md'), 'utf8');

  await applyScaffold(plan, nodeFilesystem);

  assert.equal(await readFile(join(target, '.context-rail/.gitignore'), 'utf8'), 'runtime/\n');
  const storedConfig = await readFile(join(target, '.context-rail/config.json'), 'utf8');
  assert.equal(JSON.parse(storedConfig).profile, 'existing-repository');
  const version = JSON.parse(await readFile(join(target, '.context-rail/version.json'), 'utf8'));
  assert.deepEqual(Object.keys(version.ownedFiles).sort(), ['.context-rail/.gitignore', '.context-rail/config.json']);
  assert.equal(version.ownedFiles['.context-rail/config.json'], sha256(storedConfig));
  assert.equal(version.ownedFiles['.context-rail/.gitignore'], sha256('runtime/\n'));
  assert.equal(await readFile(join(target, 'AGENTS.md'), 'utf8'), beforeAgent);
  assert.equal(await readFile(join(target, 'docs/README.md'), 'utf8'), beforeRouter);
  assert.equal((await readdir(join(target, '.context-rail'))).some((name) => name.includes('.tmp-')), false);
});

test('existing-repository upgrade conflicts when an owned file changed', async () => {
  const { planExistingRepositoryAdoption, planExistingRepositoryUpgrade } = await loadAdoptionModule();
  const target = await fixtureCopy();
  await applyScaffold(await planExistingRepositoryAdoption({ target, config: await config(), fs: nodeFilesystem }), nodeFilesystem);
  await writeFile(join(target, '.context-rail/.gitignore'), 'custom/\n');

  const plan = await planExistingRepositoryUpgrade({ target, fs: nodeFilesystem });
  assert.equal(plan.ok, false);
  assert.equal(plan.operations.find((entry) => entry.path === '.context-rail/.gitignore').action, 'conflict');
  assert.ok(plan.operations.every((entry) => MANAGED_PATHS.includes(entry.path)));
});
