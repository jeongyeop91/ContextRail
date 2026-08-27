import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { buildContinuation } from '../src/core/continuity.mjs';

function item(id, status) {
  return {
    id,
    title: id,
    status,
    dependsOn: [],
    authority: ['docs/authority/PROJECT.md'],
    sourceHints: ['src/'],
    nextSteps: ['Implement the next slice'],
    validation: [['node', '--test']],
  };
}

async function continuityProject({ active = 'CR-1', items = [item('CR-1', 'in_progress')] } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-continue-'));
  await mkdir(join(root, '.context-rail'), { recursive: true });
  await mkdir(join(root, 'docs/authority'), { recursive: true });
  await mkdir(join(root, 'state'), { recursive: true });
  await writeFile(join(root, 'AGENTS.md'), '# Guide\n');
  await writeFile(join(root, 'docs/README.md'), '# Docs\n\n[Project](authority/PROJECT.md)\n');
  await writeFile(join(root, 'docs/authority/PROJECT.md'), '# Project\n');
  await writeFile(join(root, 'state/CURRENT.md'), `# Current\n\nActive item: ${active ? `\`${active}\`` : 'none'}\n`);
  await writeFile(join(root, 'state/PLAN.md'), '# Plan\n\n- [x] Finished\n- [ ] First pending\n- [ ] Second pending\n- [ ] Third pending\n');
  await writeFile(join(root, 'state/BACKLOG.json'), JSON.stringify({ schema: 1, items }));
  await writeFile(join(root, '.context-rail/config.json'), JSON.stringify({
    documentRouter: 'docs/README.md',
    authorityDirectory: 'docs/authority',
    state: { current: 'state/CURRENT.md', plan: 'state/PLAN.md', backlog: 'state/BACKLOG.json' },
    instructionsFile: 'AGENTS.md',
  }));
  return root;
}

test('projects a valid active item and at most two plan steps', async () => {
  const result = await buildContinuation(await continuityProject());
  assert.equal(result.status, 'ready');
  assert.equal(result.currentItem.id, 'CR-1');
  assert.deepEqual(result.planSteps, ['First pending', 'Second pending']);
  assert.deepEqual(result.authorityFiles, ['docs/authority/PROJECT.md']);
});

test('returns needs_input for blocked, missing, and mismatched current work', async () => {
  const blocked = await buildContinuation(await continuityProject({ items: [item('CR-1', 'blocked')] }));
  assert.equal(blocked.status, 'needs_input');
  assert.ok(blocked.issues.some((entry) => entry.code === 'CURRENT_ITEM_BLOCKED'));

  const missing = await buildContinuation(await continuityProject({ active: 'CR-X' }));
  assert.ok(missing.issues.some((entry) => entry.code === 'CURRENT_ITEM_MISSING'));

  const mismatch = await buildContinuation(await continuityProject({ items: [item('CR-1', 'ready'), item('CR-2', 'in_progress')] }));
  assert.ok(mismatch.issues.some((entry) => entry.code === 'CURRENT_IN_PROGRESS_MISMATCH'));
});

test('selects only a unique ready item when CURRENT has no active item', async () => {
  const one = await buildContinuation(await continuityProject({ active: null, items: [item('CR-1', 'ready')] }));
  assert.equal(one.status, 'ready');
  assert.equal(one.currentItem.id, 'CR-1');

  const many = await buildContinuation(await continuityProject({ active: null, items: [item('CR-1', 'ready'), item('CR-2', 'ready')] }));
  assert.equal(many.status, 'needs_input');
  assert.ok(many.issues.some((entry) => entry.code === 'AMBIGUOUS_READY_ITEMS'));
});

test('continues reference state without guessing a backlog item', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-reference-continue-'));
  await cp(new URL('./fixtures/existing-repository/', import.meta.url).pathname, root, { recursive: true });
  const config = JSON.parse(await nodeFilesystem.readText(join(root, 'adoption-config.json')));

  const result = await buildContinuation(root, { config });
  assert.equal(result.status, 'ready');
  assert.equal(result.continuityMode, 'references');
  assert.deepEqual(result.instructionFiles, ['AGENTS.md']);
  assert.equal(result.documentRouter, 'docs/README.md');
  assert.equal(result.current, 'docs/engineering/STATUS.md');
  assert.equal(result.planDirectory, 'plans');
  assert.equal(result.backlog, 'backlog/work.yaml');
  assert.deepEqual(result.validationHints, [['node', '--test']]);
  assert.match(result.message, /project-specific format/i);
  assert.equal(result.currentItem, undefined);
});
