import assert from 'node:assert/strict';
import test from 'node:test';

import {
  renderDebugEvidence,
  renderDoctorHuman,
  renderSetupHuman,
} from '../src/cli/presentation.mjs';

const setupResult = {
  status: 'installed_live_verification_required',
  planId: 'a'.repeat(64),
  report: {
    project: { state: 'ready', issues: [] },
    throughline: { state: 'hooks_ready', version: '0.10.3-codex.5' },
    contextHooks: { state: 'registered' },
    live: { throughline: 'unverified', context: 'unverified' },
  },
};

test('setup human output is concise and omits internal plan evidence', () => {
  const output = renderSetupHuman(setupResult);
  assert.match(output, /^ContextRail setup complete/m);
  assert.match(output, /Throughline: ready \(0\.10\.3-codex\.5\)/);
  assert.match(output, /Automatic capture: needs verification/);
  assert.match(output, /Next: contextrail doctor/);
  assert.doesNotMatch(output, /aaaa|planId|artifact|https:\/\//);
  assert.equal(output.trim().split('\n').length <= 7, true);
});

test('setup human output sends changed Hook definitions to Codex review', () => {
  const output = renderSetupHuman({
    status: 'degraded',
    report: {
      project: { state: 'ready', issues: [] },
      throughline: {
        state: 'degraded',
        version: '0.10.3-codex.5',
        reasons: ['hooks_not_ready'],
      },
      contextHooks: { state: 'registered' },
    },
  });

  assert.match(output, /^ContextRail setup needs attention/m);
  assert.match(output, /changed Codex Hooks require review/i);
  assert.match(output, /Codex Hooks menu/i);
  assert.doesNotMatch(output, /--debug/);
});

test('doctor human output leads with the failing component and one action', () => {
  const output = renderDoctorHuman({
    schema: 'contextrail.doctor.v1',
    status: 'needs_attention',
    components: {
      project: 'ready',
      throughline: 'ready',
      codexHooks: 'registered',
      stopDispatch: 'not_observed',
      automaticCapture: 'unverified',
    },
    cause: 'No ContextRail Stop Hook dispatch has been observed',
    nextAction: 'Send one normal Codex prompt, then run contextrail doctor',
  });
  assert.match(output, /^ContextRail doctor needs attention/);
  assert.match(output, /Cause: No ContextRail Stop Hook dispatch/);
  assert.match(output, /Next: Send one normal Codex prompt/);
  assert.equal(output.trim().split('\n').length <= 8, true);
});

test('debug evidence redacts credential fields and token-shaped values', () => {
  const output = renderDebugEvidence({
    planId: 'b'.repeat(64),
    resolvedExecutable: 'C:\\Program Files\\nodejs\\node.exe',
    npmToken: 'npm_abcdefghijklmnopqrstuvwxyz',
    nested: { refresh_token: 'refresh-secret', stderr: 'Authorization: Bearer abcdefghijklmnop' },
  });
  assert.match(output, /Debug evidence/);
  assert.match(output, /resolvedExecutable/);
  assert.doesNotMatch(output, /npm_abcdefghijklmnopqrstuvwxyz|refresh-secret|abcdefghijklmnop/);
  assert.match(output, /\[REDACTED\]/);
});
