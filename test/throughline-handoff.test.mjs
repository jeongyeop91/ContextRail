import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { runManagedHandoff } from '../src/integrations/throughline-handoff.mjs';

async function managedFixture() {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-handoff-'));
  const managedRoot = join(root, 'managed');
  const releaseId = '0.10.3-codex.4-test';
  const packageRoot = join(managedRoot, 'releases', releaseId, 'node_modules', 'throughline');
  const binPath = join(packageRoot, 'bin', 'throughline.mjs');
  const nodePath = join(root, 'node.exe');
  await mkdir(join(packageRoot, 'bin'), { recursive: true });
  await writeFile(join(managedRoot, 'current.json'), `${JSON.stringify({ releaseId })}\n`);
  await writeFile(join(packageRoot, 'package.json'), `${JSON.stringify({ name: 'throughline', bin: { throughline: 'bin/throughline.mjs' } })}\n`);
  await writeFile(binPath, 'synthetic Throughline');
  await writeFile(nodePath, 'synthetic Node');
  return { managedRoot, nodePath, binPath };
}

test('managed handoff invokes Throughline once with execution and explicit host', async () => {
  const scope = await managedFixture();
  const calls = [];
  const processAdapter = {
    async run(executable, args) {
      calls.push([executable, ...args]);
      return {
        code: 0,
        stdout: JSON.stringify({
          status: 'started',
          reason: 'new_thread_handoff_started',
          sessionId: 'codex:source-thread',
          newThread: {
            status: 'started',
            threadId: 'new-thread',
            delivery: 'developer-item',
            injectSent: true,
          },
          open: { status: 'opened', host: 'desktop', resumeCommand: 'codex resume new-thread' },
        }),
        stderr: '',
      };
    },
  };

  const operation = await runManagedHandoff({
    managedRoot: scope.managedRoot,
    nodePath: scope.nodePath,
    sessionId: 'codex:source-thread',
    openHost: 'desktop',
    processAdapter,
    env: {},
    fs: nodeFilesystem,
  });

  assert.deepEqual(calls, [[
    scope.nodePath,
    scope.binPath,
    'codex-handoff-start',
    '--session',
    'codex:source-thread',
    '--execute',
    '--open-host',
    'desktop',
    '--json',
  ]]);
  assert.equal(operation.result.schema, 'contextrail.handoff.v1');
  assert.equal(operation.result.status, 'started');
  assert.equal(operation.result.newTask.id, 'new-thread');
  assert.equal(operation.result.memory.injected, true);
  assert.equal(operation.result.open.status, 'opened');
  assert.equal(operation.result.open.resumeCommand, null);
});

test('handoff preserves a created task when opening the host fails', async () => {
  const scope = await managedFixture();
  const processAdapter = {
    async run() {
      return {
        code: 0,
        stdout: JSON.stringify({
          status: 'started',
          sessionId: 'codex:source-thread',
          newThread: { status: 'started', threadId: 'new-thread', delivery: 'developer-item', injectSent: true },
          open: { status: 'failed', reason: 'desktop_open_failed', resumeCommand: 'codex resume new-thread --no-alt-screen' },
        }),
        stderr: '',
      };
    },
  };
  const operation = await runManagedHandoff({ ...scope, openHost: 'desktop', processAdapter, env: {}, fs: nodeFilesystem });
  assert.equal(operation.result.status, 'started');
  assert.equal(operation.result.newTask.id, 'new-thread');
  assert.equal(operation.result.open.status, 'failed');
  assert.equal(operation.result.open.resumeCommand, 'codex resume new-thread --no-alt-screen');
});

test('handoff reports upstream failure and invalid JSON without guessing memory', async () => {
  const scope = await managedFixture();
  for (const response of [
    { code: 1, stdout: '', stderr: 'Throughline handoff context is not available' },
    { code: 0, stdout: '{invalid', stderr: '' },
  ]) {
    const operation = await runManagedHandoff({
      ...scope,
      processAdapter: { async run() { return response; } },
      env: {},
      fs: nodeFilesystem,
    });
    assert.equal(operation.result.status, 'needs_attention');
    assert.equal(operation.result.newTask, null);
  }
});
