import assert from 'node:assert/strict';
import test from 'node:test';

import { run } from '../src/cli/main.mjs';

function capture() {
  let stdout = '';
  let stderr = '';
  return {
    io: { stdout: { write: (value) => { stdout += value; } }, stderr: { write: (value) => { stderr += value; } }, stdin: { isTTY: false } },
    output: () => ({ stdout, stderr }),
  };
}

function planned(id = 'a'.repeat(64), status = 'planned') {
  return {
    plan: {
      schema: 1,
      id,
      status,
      profile: 'full',
      target: '/project',
      platform: 'linux',
      project: { kind: 'new', candidates: [] },
      steps: [{ id: 'project', action: 'init' }],
      issues: [],
      applyRequired: status === 'planned',
    },
    execution: {},
  };
}

test('flagless non-TTY setup is plan-only and never reads confirmation or applies', async () => {
  const stream = capture();
  let confirms = 0;
  let applies = 0;
  const code = await run(['setup'], stream.io, {
    stdinIsTTY: false,
    planSetup: async () => planned(),
    confirm: async () => { confirms += 1; return true; },
    applySetup: async () => { applies += 1; },
  });
  assert.equal(code, 0);
  assert.equal(JSON.parse(stream.output().stdout).status, 'planned');
  assert.equal(confirms, 0);
  assert.equal(applies, 0);
});

test('interactive setup renders the plan and applies only after affirmative confirmation', async () => {
  for (const [answer, expectedApplies] of [['n', 0], ['y', 1], ['yes', 1]]) {
    const stream = capture();
    let applies = 0;
    const code = await run(['setup'], stream.io, {
      stdinIsTTY: true,
      planSetup: async () => planned(),
      confirm: async (question) => {
        assert.equal(question, 'Apply? [y/N] ');
        return answer;
      },
      applySetup: async ({ approvedPlanId }) => {
        assert.equal(approvedPlanId, 'a'.repeat(64));
        applies += 1;
        return { status: 'installed_live_verification_required' };
      },
    });
    assert.equal(code, 0);
    assert.equal(applies, expectedApplies);
    assert.match(stream.output().stdout, /"status": "planned"/);
  }
});

test('interactive confirmation is invalidated when the re-planned identity changes', async () => {
  const stream = capture();
  let plans = 0;
  let applies = 0;
  const code = await run(['setup'], stream.io, {
    stdinIsTTY: true,
    planSetup: async () => planned((plans += 1) === 1 ? 'a'.repeat(64) : 'b'.repeat(64)),
    confirm: async () => 'y',
    applySetup: async () => { applies += 1; },
  });
  assert.equal(code, 3);
  assert.equal(applies, 0);
  assert.match(stream.output().stderr, /changed after confirmation/i);
});

test('explicit JSON dry-run and apply remain machine-readable boundaries', async () => {
  const dry = capture();
  let applies = 0;
  assert.equal(await run(['setup', '--dry-run', '--json'], dry.io, {
    planSetup: async (dependencies) => {
      assert.equal(dependencies.input.coreOnly, false);
      return planned();
    },
    applySetup: async () => { applies += 1; },
  }), 0);
  assert.equal(JSON.parse(dry.output().stdout).id, 'a'.repeat(64));
  assert.equal(applies, 0);

  const apply = capture();
  assert.equal(await run(['setup', '--apply', '--json'], apply.io, {
    planSetup: async () => planned(),
    applySetup: async () => ({ status: 'installed_live_verification_required', planId: 'a'.repeat(64) }),
  }), 0);
  assert.equal(JSON.parse(apply.output().stdout).status, 'installed_live_verification_required');
});

test('setup returns needs_input and rejects ambiguous or incompatible CLI flags', async () => {
  const input = capture();
  assert.equal(await run(['setup', '--dry-run', '--json'], input.io, { planSetup: async () => planned('a'.repeat(64), 'needs_input') }), 1);
  assert.equal(JSON.parse(input.output().stdout).status, 'needs_input');

  for (const args of [
    ['setup', '--dry-run', '--apply'],
    ['setup', '--core-only', '--no-context-hooks', '--dry-run'],
    ['setup', '--project', 'new', '--adoption-config', 'mapping.json', '--dry-run'],
  ]) {
    const stream = capture();
    assert.equal(await run(args, stream.io, { planSetup: async () => planned() }), 2);
    assert.notEqual(stream.output().stderr, '');
  }
});

