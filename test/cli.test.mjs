import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { run } from '../src/cli/main.mjs';

function capture() {
  let stdout = '';
  let stderr = '';
  return {
    io: { stdout: { write: (value) => { stdout += value; } }, stderr: { write: (value) => { stderr += value; } } },
    output: () => ({ stdout, stderr }),
  };
}

test('init defaults to a non-writing JSON plan', async () => {
  const target = await mkdtemp(join(tmpdir(), 'contextrail-cli-'));
  const stream = capture();
  const code = await run(['init', '--target', target, '--dry-run', '--json'], stream.io);
  const output = JSON.parse(stream.output().stdout);
  assert.equal(code, 0);
  assert.ok(output.operations.some((entry) => entry.action === 'create'));
});

test('route and continue emit structured repository context', async () => {
  const original = process.cwd();
  const streamRoute = capture();
  const routeCode = await run(['route', 'src/core/documents.mjs', '--target', original, '--json'], streamRoute.io);
  assert.equal(routeCode, 0);
  assert.ok(JSON.parse(streamRoute.output().stdout).instructionFiles.includes('src/AGENTS.md'));

  const streamContinue = capture();
  const continueCode = await run(['continue', '--target', original, '--json'], streamContinue.io);
  assert.equal(continueCode, 0);
  assert.equal(JSON.parse(streamContinue.output().stdout).currentItem.id, 'CR-001');
});

test('unknown commands return CLI usage exit code', async () => {
  const stream = capture();
  assert.equal(await run(['unknown'], stream.io), 2);
  assert.match(stream.output().stderr, /Usage:/);
});

test('measure record and report keep provenance in local runtime data', async () => {
  const target = await mkdtemp(join(tmpdir(), 'contextrail-cli-measure-'));
  const recordStream = capture();
  const recordCode = await run([
    'measure', 'record', '--target', target, '--task', 'CR-001', '--session', 'session-a', '--source', 'manual',
    '--input-tokens', '100', '--output-tokens', '20', '--json',
  ], recordStream.io);
  assert.equal(recordCode, 0, recordStream.output().stderr);

  const reportStream = capture();
  const reportCode = await run(['measure', 'report', '--target', target, '--json'], reportStream.io);
  assert.equal(reportCode, 0);
  const report = JSON.parse(reportStream.output().stdout);
  assert.equal(report.metrics.inputTokens.sources.manual.total, 100);
  assert.equal(report.metrics.outputTokens.reported.total, 20);
});

test('Throughline prepare dry-run returns the pinned plan without external work', async () => {
  const stream = capture();
  const code = await run(['throughline', 'prepare', '--dry-run', '--json'], stream.io);
  assert.equal(code, 0, stream.output().stderr);
  const plan = JSON.parse(stream.output().stdout);
  assert.equal(plan.status, 'planned');
  assert.match(plan.baseCommit, /^[a-f\d]{40}$/);
  assert.equal(plan.steps[0].action, 'clone');
});

test('Throughline install dry-run plans a managed release without creating it', async () => {
  const managedRoot = join(await mkdtemp(join(tmpdir(), 'contextrail-cli-managed-parent-')), 'managed');
  const stream = capture();
  const code = await run(['throughline', 'install', '--dry-run', '--managed-root', managedRoot, '--json'], stream.io);
  assert.equal(code, 0, stream.output().stderr);
  const plan = JSON.parse(stream.output().stdout);
  assert.equal(plan.status, 'planned');
  assert.equal(plan.applyRequired, true);
  assert.equal(plan.releaseDirectory.startsWith(managedRoot), true);
});

test('Throughline verify reports structured readiness through a read-only adapter', async () => {
  const stream = capture();
  const processAdapter = {
    async run(_binary, args) {
      if (args[0] === '--version') return { code: 0, stdout: '0.10.3-codex.1\n', stderr: '' };
      return {
        code: 0,
        stdout: JSON.stringify({ schema: 'throughline.native_factory_diagnostics.v1', overall: { status: 'ready' }, hooks: { status: 'ready' }, readiness: {} }),
        stderr: '',
      };
    },
  };
  const code = await run(['throughline', 'verify', '--json'], stream.io, { processAdapter });
  assert.equal(code, 0);
  assert.equal(JSON.parse(stream.output().stdout).state, 'hooks_ready');
});
