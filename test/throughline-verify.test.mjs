import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateThroughlineReadiness, verifyThroughline } from '../src/integrations/throughline-verify.mjs';

const readyDiagnostics = {
  schema: 'throughline.native_factory_diagnostics.v1',
  version: '0.10.3-codex.1',
  overall: { status: 'ready' },
  hooks: { status: 'ready' },
  readiness: { capture: { status: 'ready' }, restore: { status: 'ready' }, handoff: { status: 'ready' } },
};

test('classifies absent, prepared, installed, and incompatible states', () => {
  assert.equal(evaluateThroughlineReadiness({ binaryPresent: false }).state, 'absent');
  assert.equal(evaluateThroughlineReadiness({ binaryPresent: false, prepared: true }).state, 'prepared');
  assert.equal(evaluateThroughlineReadiness({ binaryPresent: true, version: '0.10.3', diagnostics: null }).state, 'installed');
  assert.equal(evaluateThroughlineReadiness({ binaryPresent: true, version: null, diagnostics: null }).state, 'incompatible');
});

test('distinguishes hooks readiness, verified capture, and degraded diagnostics', () => {
  assert.equal(evaluateThroughlineReadiness({ binaryPresent: true, version: '0.10.3', diagnostics: readyDiagnostics }).state, 'hooks_ready');
  assert.equal(evaluateThroughlineReadiness({
    binaryPresent: true,
    version: '0.10.3',
    diagnostics: readyDiagnostics,
    captureEvidence: { capturedRows: 2, capturedDetails: 1, injectedContextExcluded: true },
  }).state, 'capture_verified');
  assert.equal(evaluateThroughlineReadiness({
    binaryPresent: true,
    version: '0.10.3',
    diagnostics: { ...readyDiagnostics, overall: { status: 'not_ready' }, hooks: { status: 'not_ready' } },
  }).state, 'degraded');
});

test('registered hooks without non-zero capture bodies never verify capture', () => {
  const result = evaluateThroughlineReadiness({
    binaryPresent: true,
    version: '0.10.3',
    diagnostics: readyDiagnostics,
    captureEvidence: { capturedRows: 0, capturedDetails: 4, injectedContextExcluded: true },
  });
  assert.equal(result.state, 'hooks_ready');
  assert.ok(result.reasons.includes('capture_evidence_incomplete'));
});

test('invokes a JavaScript bin through an absolute Node runtime for read-only verify', async () => {
  const calls = [];
  const adapter = {
    async run(executable, args) {
      calls.push([executable, ...args]);
      if (args[1] === '--version') return { code: 0, stdout: '0.10.3-codex.1\n', stderr: '' };
      return { code: 0, stdout: JSON.stringify(readyDiagnostics), stderr: '' };
    },
  };
  const result = await verifyThroughline({ nodePath: '/runtime/node', binPath: '/managed/throughline/bin/cli.mjs', processAdapter: adapter });
  assert.equal(result.state, 'hooks_ready');
  assert.deepEqual(calls, [
    ['/runtime/node', '/managed/throughline/bin/cli.mjs', '--version'],
    ['/runtime/node', '/managed/throughline/bin/cli.mjs', 'factory-diagnostics', '--json'],
  ]);
});
