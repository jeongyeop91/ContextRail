import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

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
