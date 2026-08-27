import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { buildRoute } from '../src/core/routing.mjs';

async function routedProject() {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-route-'));
  await mkdir(join(root, 'src/core'), { recursive: true });
  await mkdir(join(root, 'src/sibling'), { recursive: true });
  await mkdir(join(root, 'docs/authority'), { recursive: true });
  await mkdir(join(root, 'state'), { recursive: true });
  await writeFile(join(root, 'AGENTS.md'), '# Root\n');
  await writeFile(join(root, 'src/AGENTS.md'), '# Source\n');
  await writeFile(join(root, 'src/core/AGENTS.md'), '# Core\n');
  await writeFile(join(root, 'src/sibling/AGENTS.md'), '# Sibling\n');
  await writeFile(join(root, 'src/core/value.mjs'), 'export {};\n');
  await writeFile(join(root, 'docs/README.md'), '# Docs\n\n[Project](authority/PROJECT.md)\n');
  await writeFile(join(root, 'docs/authority/PROJECT.md'), '# Project\n');
  await writeFile(join(root, 'state/CURRENT.md'), '# Current\n\nActive item: `CR-1`\n');
  await writeFile(join(root, 'state/BACKLOG.json'), JSON.stringify({ items: [{ id: 'CR-1', status: 'in_progress', validation: [['node', '--test']] }] }));
  await writeFile(join(root, '.context-rail.json'), JSON.stringify({
    documentRouter: 'docs/README.md',
    authorityDirectory: 'docs/authority',
    state: { current: 'state/CURRENT.md', backlog: 'state/BACKLOG.json' },
    instructionsFile: 'AGENTS.md',
  }));
  return root;
}

test('routes instructions root-to-target without siblings', async () => {
  const root = await routedProject();
  const route = await buildRoute(root, 'src/core/value.mjs', { configPath: '.context-rail.json' });
  assert.deepEqual(route.instructionFiles, ['AGENTS.md', 'src/AGENTS.md', 'src/core/AGENTS.md']);
  assert.equal(route.instructionFiles.includes('src/sibling/AGENTS.md'), false);
  assert.equal(route.instructionBytes, Buffer.byteLength('# Root\n# Source\n# Core\n'));
  assert.deepEqual(route.routerDocuments, ['docs/README.md', 'docs/authority/PROJECT.md']);
  assert.equal(route.currentItem.id, 'CR-1');
  assert.deepEqual(route.validation, [['node', '--test']]);
});

test('rejects a route target outside the project', async () => {
  const root = await routedProject();
  await assert.rejects(() => buildRoute(root, '../outside.mjs', { configPath: '.context-rail.json' }), /outside repository root/);
});

test('routes existing repository references without parsing its backlog', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-reference-route-'));
  await cp(new URL('./fixtures/existing-repository/', import.meta.url), root, { recursive: true });
  const config = JSON.parse(await nodeFilesystem.readText(join(root, 'adoption-config.json')));

  const route = await buildRoute(root, 'src/service/value.mjs', { config });
  assert.deepEqual(route.instructionFiles, ['AGENTS.md', 'src/AGENTS.md']);
  assert.equal(route.documentRouter, 'docs/README.md');
  assert.deepEqual(route.routerDocuments, [
    'docs/README.md',
    'docs/product/PRODUCT.md',
    'docs/architecture/OVERVIEW.md',
    'docs/engineering/GUIDE.md',
    'docs/engineering/STATUS.md',
    'plans/2026-08-27-bootstrap.md',
  ]);
  assert.deepEqual(route.referenceState, {
    mode: 'references',
    current: 'docs/engineering/STATUS.md',
    planDirectory: 'plans',
    backlog: 'backlog/work.yaml',
  });
  assert.deepEqual(route.validationHints, [['node', '--test']]);
  assert.equal(route.currentItem, undefined);
});
