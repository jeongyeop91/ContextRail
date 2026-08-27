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
