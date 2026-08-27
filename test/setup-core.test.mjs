import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSetupPlan, classifyProject, normalizeSetupOptions, setupPlanId } from '../src/core/setup.mjs';

test('normalizes the full default and supported reduced setup profiles', () => {
  assert.deepEqual(normalizeSetupOptions({}), {
    ok: true,
    issues: [],
    options: { profile: 'full', project: 'auto', adoptionConfig: null },
  });
  assert.equal(normalizeSetupOptions({ coreOnly: true }).options.profile, 'core_only');
  assert.equal(normalizeSetupOptions({ noContextHooks: true }).options.profile, 'memory_without_context_hooks');
  assert.equal(normalizeSetupOptions({ useExistingThroughline: true }).options.profile, 'existing_throughline');
});

test('rejects incompatible profiles and project mapping combinations', () => {
  for (const input of [
    { coreOnly: true, noContextHooks: true },
    { coreOnly: true, useExistingThroughline: true },
    { noContextHooks: true, useExistingThroughline: true },
    { project: 'new', adoptionConfig: 'mapping.json' },
    { project: 'other' },
  ]) {
    const result = normalizeSetupOptions(input);
    assert.equal(result.ok, false);
    assert.ok(result.issues.length > 0);
  }
});

test('classifies only empty or git-only targets as new and valid ContextRail targets as configured', () => {
  assert.equal(classifyProject({ entries: [], configState: 'absent' }).kind, 'new');
  assert.equal(classifyProject({ entries: ['.git'], configState: 'absent' }).kind, 'new');
  assert.equal(classifyProject({ entries: ['.git', 'README.md'], configState: 'absent' }).kind, 'existing');
  assert.equal(classifyProject({ entries: ['src', '.context-rail'], configState: 'valid' }).kind, 'configured');
  assert.equal(classifyProject({ entries: ['.context-rail'], configState: 'invalid' }).kind, 'existing');
});

test('reports bounded candidate paths for an existing repository', () => {
  const result = classifyProject({
    entries: ['AGENTS.md', 'README.md', 'docs', 'src', '.git', 'package.json', 'notes.txt'],
    configState: 'absent',
  });
  assert.equal(result.kind, 'existing');
  assert.deepEqual(result.candidates, ['AGENTS.md', 'README.md', 'docs', 'notes.txt', 'package.json', 'src']);
});

test('builds an ordered plan whose identity changes with public preconditions', () => {
  const input = {
    options: { profile: 'full', project: 'auto', adoptionConfig: null },
    discovery: { target: '/project', project: { kind: 'new' }, platform: 'linux' },
    components: [
      { id: 'throughline', action: 'install', preconditionHash: 'a'.repeat(64) },
      { id: 'project', action: 'init', preconditionHash: 'b'.repeat(64) },
      { id: 'context_hooks', action: 'install', preconditionHash: 'c'.repeat(64) },
      { id: 'automation', action: 'enable', preconditionHash: 'd'.repeat(64) },
      { id: 'verify', action: 'aggregate' },
    ],
  };
  const plan = buildSetupPlan(input);
  assert.equal(plan.status, 'planned');
  assert.deepEqual(plan.steps.map(({ id }) => id), ['throughline', 'project', 'context_hooks', 'automation', 'verify']);
  assert.equal(plan.id, setupPlanId({ ...plan, id: undefined }));

  const changed = structuredClone(input);
  changed.components[0].preconditionHash = 'e'.repeat(64);
  assert.notEqual(buildSetupPlan(changed).id, plan.id);
});

test('returns needs_input instead of inventing mappings for an existing repository', () => {
  const plan = buildSetupPlan({
    options: { profile: 'full', project: 'auto', adoptionConfig: null },
    discovery: { target: '/project', project: { kind: 'existing', candidates: ['README.md', 'docs'] }, platform: 'win32' },
    components: [],
  });
  assert.equal(plan.status, 'needs_input');
  assert.equal(plan.applyRequired, false);
  assert.deepEqual(plan.project.candidates, ['README.md', 'docs']);
});
