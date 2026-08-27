import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { applyScaffold, planScaffold } from '../src/core/scaffold.mjs';
import { validateProject } from '../src/cli/main.mjs';

async function template(files) {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-template-'));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), content);
  }
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ schema: 1, files: Object.keys(files) }));
  return root;
}

test('dry-run plans creates without writing', async () => {
  const source = await template({ 'AGENTS.md': '# Guide\n' });
  const target = await mkdtemp(join(tmpdir(), 'contextrail-target-'));
  const plan = await planScaffold({ mode: 'init', target, templateRoot: source, fs: nodeFilesystem });
  assert.deepEqual(plan.operations.map(({ action, path }) => ({ action, path })), [{ action: 'create', path: 'AGENTS.md' }]);
  assert.equal(await nodeFilesystem.exists(join(target, 'AGENTS.md')), false);
});

test('init reports non-empty targets and adopt preserves existing files', async () => {
  const source = await template({ 'AGENTS.md': '# Template\n', 'docs/README.md': '# Docs\n' });
  const target = await mkdtemp(join(tmpdir(), 'contextrail-target-'));
  await writeFile(join(target, 'AGENTS.md'), '# Existing\n');
  const initPlan = await planScaffold({ mode: 'init', target, templateRoot: source, fs: nodeFilesystem });
  assert.equal(initPlan.ok, false);
  assert.ok(initPlan.issues.some((entry) => entry.code === 'TARGET_NOT_EMPTY'));

  const adoptPlan = await planScaffold({ mode: 'adopt', target, templateRoot: source, fs: nodeFilesystem });
  assert.equal(adoptPlan.operations.find((entry) => entry.path === 'AGENTS.md').action, 'skip');
  await applyScaffold(adoptPlan, nodeFilesystem);
  assert.equal(await readFile(join(target, 'AGENTS.md'), 'utf8'), '# Existing\n');
  assert.equal(await readFile(join(target, 'docs/README.md'), 'utf8'), '# Docs\n');
});

test('rejects template path traversal', async () => {
  const source = await template({ 'AGENTS.md': '# Guide\n' });
  await writeFile(join(source, 'manifest.json'), JSON.stringify({ schema: 1, files: ['../outside.md'] }));
  const target = await mkdtemp(join(tmpdir(), 'contextrail-target-'));
  const plan = await planScaffold({ mode: 'init', target, templateRoot: source, fs: nodeFilesystem });
  assert.ok(plan.issues.some((entry) => entry.code === 'TEMPLATE_PATH_ESCAPE'));
});

test('repository template applies and passes project validation', async () => {
  const target = await mkdtemp(join(tmpdir(), 'contextrail-target-'));
  const templateRoot = fileURLToPath(new URL('../templates/project/', import.meta.url));
  const plan = await planScaffold({ mode: 'init', target, templateRoot, fs: nodeFilesystem });
  assert.equal(plan.ok, true);
  await applyScaffold(plan, nodeFilesystem);
  const result = await validateProject(target);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.equal((await readFile(join(target, 'AGENTS.md'), 'utf8')).includes('/Users/'), false);
});

test('records owned hashes so upgrades update only unchanged scaffold files', async () => {
  const source = await template({
    'A.md': 'version one\n',
    '.context-rail/version.json': JSON.stringify({ schema: 1, templateVersion: '1.0.0', ownedFiles: {} }),
  });
  const target = await mkdtemp(join(tmpdir(), 'contextrail-target-'));
  await applyScaffold(await planScaffold({ mode: 'init', target, templateRoot: source, fs: nodeFilesystem }), nodeFilesystem);
  const ownership = JSON.parse(await readFile(join(target, '.context-rail/version.json'), 'utf8'));
  assert.match(ownership.ownedFiles['A.md'], /^[a-f\d]{64}$/);

  await writeFile(join(source, 'A.md'), 'version two\n');
  const upgrade = await planScaffold({ mode: 'upgrade', target, templateRoot: source, fs: nodeFilesystem });
  assert.equal(upgrade.operations.find((entry) => entry.path === 'A.md').action, 'update');

  await writeFile(join(target, 'A.md'), 'user change\n');
  const conflict = await planScaffold({ mode: 'upgrade', target, templateRoot: source, fs: nodeFilesystem });
  assert.equal(conflict.operations.find((entry) => entry.path === 'A.md').action, 'conflict');
});
