import assert from 'node:assert/strict';
import test from 'node:test';

import { run } from '../src/cli/main.mjs';
import { buildDoctorReport } from '../src/integrations/doctor.mjs';

function capture() {
  let stdout = '';
  let stderr = '';
  return {
    io: { stdout: { write: (value) => { stdout += value; } }, stderr: { write: (value) => { stderr += value; } } },
    output: () => ({ stdout, stderr }),
  };
}

function setupReport(overrides = {}) {
  return {
    status: 'installed_live_verification_required',
    project: { state: 'ready' },
    throughline: { state: 'hooks_ready', version: '0.10.3-codex.3' },
    contextHooks: { state: 'registered' },
    live: { throughline: 'unverified', context: 'unverified' },
    ...overrides,
  };
}

test('doctor distinguishes Stop dispatch evidence from Throughline capture evidence', () => {
  const report = buildDoctorReport({
    setupReport: setupReport(),
    hookEvent: {
      schema: 1,
      event: 'Stop',
      observedAt: '2026-08-31T03:00:00.000Z',
      sessionIdHash: 'a'.repeat(64),
      sessionIdSource: 'payload:session_id',
      projectMatched: true,
      status: 'passed',
    },
  });
  assert.equal(report.status, 'needs_attention');
  assert.equal(report.components.stopDispatch, 'observed');
  assert.equal(report.components.automaticCapture, 'unverified');
  assert.match(report.cause, /capture has not been verified/i);
});

test('doctor reports ready only with project, hooks, dispatch, and capture evidence', () => {
  const report = buildDoctorReport({
    setupReport: setupReport({
      status: 'installed',
      throughline: { state: 'capture_verified', version: '0.10.3-codex.3' },
      live: { throughline: 'verified', context: 'verified' },
    }),
    hookEvent: {
      schema: 1,
      event: 'Stop',
      observedAt: '2026-08-31T03:00:00.000Z',
      sessionIdHash: 'a'.repeat(64),
      sessionIdSource: 'payload:session_id',
      projectMatched: true,
      status: 'passed',
    },
  });
  assert.equal(report.status, 'ready');
  assert.equal(report.nextAction, 'contextrail handoff');
});

test('top-level doctor selects concise, json, and debug output modes', async () => {
  const report = buildDoctorReport({ setupReport: setupReport(), hookEvent: null });

  const human = capture();
  assert.equal(await run(['doctor'], human.io, { doctorReport: report }), 3);
  assert.match(human.output().stdout, /^ContextRail doctor needs attention/);
  assert.doesNotMatch(human.output().stdout, /"schema"/);

  const json = capture();
  assert.equal(await run(['doctor', '--json'], json.io, { doctorReport: report }), 3);
  assert.equal(JSON.parse(json.output().stdout).schema, 'contextrail.doctor.v1');

  const debug = capture();
  assert.equal(await run(['doctor', '--debug'], debug.io, { doctorReport: report }), 3);
  assert.match(debug.output().stdout, /Debug evidence/);
});
