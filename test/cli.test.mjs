import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
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

  const continuationTarget = await mkdtemp(join(tmpdir(), 'contextrail-cli-continue-'));
  const initStream = capture();
  assert.equal(await run(['init', '--target', continuationTarget, '--apply', '--json'], initStream.io), 0);
  const streamContinue = capture();
  const continueCode = await run(['continue', '--target', continuationTarget, '--json'], streamContinue.io);
  assert.equal(continueCode, 0);
  const continuation = JSON.parse(streamContinue.output().stdout);
  assert.equal(continuation.status, 'ready');
  assert.match(continuation.currentItem.id, /^CR-\d+$/);
});

test('unknown commands return CLI usage exit code', async () => {
  const stream = capture();
  assert.equal(await run(['unknown'], stream.io), 2);
  assert.match(stream.output().stderr, /Usage:/);
});

test('version and help are successful read-only top-level options', async () => {
  const version = capture();
  assert.equal(await run(['--version'], version.io), 0);
  assert.equal(version.output().stdout, '0.3.0-rc.9\n');
  assert.equal(version.output().stderr, '');

  const help = capture();
  assert.equal(await run(['--help'], help.io), 0);
  assert.match(help.output().stdout, /^Usage:/);
  assert.match(help.output().stdout, /contextrail setup .*\[--debug\|--json\]/);
  assert.equal(help.output().stderr, '');
});

test('existing-repository adoption requires its profile and config then remains plan-only', async () => {
  const target = await mkdtemp(join(tmpdir(), 'contextrail-cli-existing-'));
  const fixture = new URL('./fixtures/existing-repository/', import.meta.url);
  await cp(fixture, target, { recursive: true });
  const adoptionConfig = join(target, 'adoption-config.json');

  const missing = capture();
  assert.equal(await run(['adopt', '--target', target, '--profile', 'existing-repository', '--dry-run', '--json'], missing.io), 2);

  const stream = capture();
  const code = await run([
    'adopt', '--target', target, '--profile', 'existing-repository', '--adoption-config', adoptionConfig, '--dry-run', '--json',
  ], stream.io);
  assert.equal(code, 0, stream.output().stderr);
  const plan = JSON.parse(stream.output().stdout);
  assert.deepEqual(plan.operations.map((entry) => entry.path).sort(), [
    '.context-rail/.gitignore',
    '.context-rail/config.json',
    '.context-rail/version.json',
  ]);
  assert.equal(await readFile(join(target, 'AGENTS.md'), 'utf8'), '# Existing repository guide\n\nRead `docs/README.md` and preserve existing project memory.\n');
});

test('check returns structured reference state after existing-repository apply', async () => {
  const target = await mkdtemp(join(tmpdir(), 'contextrail-cli-existing-check-'));
  const fixture = new URL('./fixtures/existing-repository/', import.meta.url);
  await cp(fixture, target, { recursive: true });
  const adoptionConfig = join(target, 'adoption-config.json');
  const applyStream = capture();
  assert.equal(await run([
    'adopt', '--target', target, '--profile', 'existing-repository', '--adoption-config', adoptionConfig, '--apply', '--json',
  ], applyStream.io), 0, applyStream.output().stderr);

  const checkStream = capture();
  assert.equal(await run(['check', '--target', target, '--json'], checkStream.io), 0, checkStream.output().stderr);
  const result = JSON.parse(checkStream.output().stdout);
  assert.equal(result.summary.state.stateMode, 'references');
  assert.deepEqual(result.summary.state.validationHints, [['node', '--test']]);
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
  const managedRoot = join(await mkdtemp(join(tmpdir(), 'contextrail-cli-empty-managed-')), 'managed');
  const stream = capture();
  const processAdapter = {
    async run(_binary, args) {
      if (args[0] === '--version') return { code: 0, stdout: '0.10.3-codex.2\n', stderr: '' };
      return {
        code: 0,
        stdout: JSON.stringify({ schema: 'throughline.native_factory_diagnostics.v1', overall: { status: 'ready' }, hooks: { status: 'ready' }, readiness: {} }),
        stderr: '',
      };
    },
  };
  const code = await run(['throughline', 'verify', '--json'], stream.io, { managedRoot, processAdapter });
  assert.equal(code, 0);
  assert.equal(JSON.parse(stream.output().stdout).state, 'hooks_ready');
});

test('Throughline verify and doctor use the selected managed JavaScript binary', async () => {
  const managedRoot = join(await mkdtemp(join(tmpdir(), 'contextrail-cli-managed-')), 'managed');
  const releaseId = '0.10.3-codex.2-test';
  const packageRoot = join(managedRoot, 'releases', releaseId, 'node_modules', 'throughline');
  const binPath = join(packageRoot, 'bin', 'cli.mjs');
  const nodePath = join(managedRoot, 'runtime', 'node.exe');
  await mkdir(join(packageRoot, 'bin'), { recursive: true });
  await mkdir(join(managedRoot, 'runtime'), { recursive: true });
  await writeFile(join(managedRoot, 'current.json'), `${JSON.stringify({ releaseId })}\n`);
  await writeFile(join(packageRoot, 'package.json'), `${JSON.stringify({ name: 'throughline', bin: { throughline: 'bin/cli.mjs' } })}\n`);
  await writeFile(binPath, 'synthetic Throughline CLI');
  await writeFile(nodePath, 'synthetic Node runtime');

  const calls = [];
  const processAdapter = {
    async run(executable, args) {
      calls.push([executable, ...args]);
      if (executable !== nodePath) {
        const error = new Error(`spawn ${executable} ENOENT`);
        error.code = 'ENOENT';
        throw error;
      }
      if (args[1] === '--version') return { code: 0, stdout: '0.10.3-codex.2\n', stderr: '' };
      if (args[1] === 'factory-diagnostics') {
        return {
          code: 0,
          stdout: JSON.stringify({ schema: 'throughline.native_factory_diagnostics.v1', overall: { status: 'ready' }, hooks: { status: 'ready' }, readiness: {} }),
          stderr: '',
        };
      }
      return { code: 0, stdout: 'Codex hooks: trusted\n', stderr: '' };
    },
  };
  const stream = capture();
  const code = await run(['throughline', 'verify', '--doctor'], stream.io, {
    managedRoot,
    nodePath,
    processAdapter,
  });

  assert.equal(code, 0, stream.output().stderr);
  assert.match(stream.output().stdout, /Codex hooks: trusted/);
  assert.deepEqual(calls, [
    [nodePath, binPath, '--version'],
    [nodePath, binPath, 'factory-diagnostics', '--json'],
    [nodePath, binPath, 'doctor', '--codex'],
  ]);
});

test('handoff has concise, json, and debug output without exposing raw upstream output by default', async () => {
  const operation = {
    result: {
      schema: 'contextrail.handoff.v1',
      status: 'started',
      sourceSession: 'codex:source-thread',
      newTask: { id: 'new-thread', status: 'started' },
      memory: { injected: true, delivery: 'developer-item' },
      open: { status: 'opened', host: 'desktop', resumeCommand: null },
    },
    debugEvidence: { upstream: { stdout: 'raw-internal-output', stderr: '' } },
  };
  const human = capture();
  assert.equal(await run(['handoff', '--open-host', 'desktop'], human.io, {
    runManagedHandoff: async () => operation,
  }), 0);
  assert.match(human.output().stdout, /ContextRail handoff started/);
  assert.match(human.output().stdout, /New task: new-thread/);
  assert.doesNotMatch(human.output().stdout, /raw-internal-output|"schema"/);

  const json = capture();
  assert.equal(await run(['handoff', '--session', 'codex:source-thread', '--json'], json.io, {
    runManagedHandoff: async (options) => {
      assert.equal(options.sessionId, 'codex:source-thread');
      return operation;
    },
  }), 0);
  assert.equal(JSON.parse(json.output().stdout).newTask.id, 'new-thread');

  const debug = capture();
  assert.equal(await run(['handoff', '--debug'], debug.io, {
    runManagedHandoff: async () => operation,
  }), 0);
  assert.match(debug.output().stdout, /Debug evidence/);
  assert.match(debug.output().stdout, /raw-internal-output/);
});
