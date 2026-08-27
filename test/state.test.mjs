import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { validateState } from '../src/core/state.mjs';
import { nodeFilesystem } from '../src/adapters/filesystem.mjs';

const config = { state: { current: 'state/CURRENT.md', plan: 'state/PLAN.md', backlog: 'state/BACKLOG.json' } };

function item(id, status = 'ready', dependsOn = []) {
  return {
    id,
    title: id,
    status,
    dependsOn,
    acceptance: ['accepted'],
    authority: ['docs/authority/PROJECT.md'],
    sourceHints: ['src/'],
    nextSteps: ['continue'],
    validation: [['node', '--version']],
  };
}

async function stateProject({ items = [item('CR-1', 'in_progress')], active = 'CR-1', plan = true, extraPlans = [] } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-state-'));
  await mkdir(join(root, 'state'), { recursive: true });
  await writeFile(join(root, 'state/CURRENT.md'), `# Current\n\nActive item: ${active ? `\`${active}\`` : 'none'}\n`);
  await writeFile(join(root, 'state/BACKLOG.json'), JSON.stringify({ schema: 1, items }, null, 2));
  if (plan) await writeFile(join(root, 'state/PLAN.md'), '# Plan\n');
  for (const name of extraPlans) await writeFile(join(root, `state/${name}`), '# Another active plan\n');
  return root;
}

async function codes(options) {
  const root = await stateProject(options);
  const result = await validateState(root, config, nodeFilesystem);
  return result.issues.map((issue) => issue.code);
}

test('reports duplicate backlog IDs', async () => {
  assert.ok((await codes({ items: [item('CR-1', 'in_progress'), item('CR-1')] })).includes('DUPLICATE_BACKLOG_ID'));
});

test('reports unknown and cyclic dependencies', async () => {
  const found = await codes({
    items: [item('CR-1', 'in_progress', ['CR-2']), item('CR-2', 'ready', ['CR-1']), item('CR-3', 'ready', ['CR-X'])],
  });
  assert.ok(found.includes('CYCLIC_DEPENDENCY'));
  assert.ok(found.includes('UNKNOWN_DEPENDENCY'));
});

test('reports invalid status and shell-string validation', async () => {
  const invalid = item('CR-1', 'working');
  invalid.validation = ['npm test'];
  const found = await codes({ items: [invalid] });
  assert.ok(found.includes('INVALID_BACKLOG_STATUS'));
  assert.ok(found.includes('INVALID_VALIDATION_ARGV'));
});

test('reports CURRENT references to missing or completed items', async () => {
  assert.ok((await codes({ active: 'CR-X' })).includes('CURRENT_ITEM_MISSING'));
  assert.ok((await codes({ items: [item('CR-1', 'done')] })).includes('CURRENT_ITEM_NOT_ACTIVE'));
});

test('reports an in-progress item that does not match CURRENT', async () => {
  const found = await codes({ items: [item('CR-1', 'in_progress'), item('CR-2', 'ready')], active: 'CR-2' });
  assert.ok(found.includes('CURRENT_IN_PROGRESS_MISMATCH'));
});

test('requires exactly one active plan', async () => {
  assert.ok((await codes({ plan: false })).includes('MISSING_ACTIVE_PLAN'));
  assert.ok((await codes({ extraPlans: ['PLAN-extra.md'] })).includes('MULTIPLE_ACTIVE_PLANS'));
});

test('accepts a consistent active state', async () => {
  const root = await stateProject();
  const result = await validateState(root, config, nodeFilesystem);
  assert.deepEqual(result.issues, []);
  assert.equal(result.ok, true);
});
