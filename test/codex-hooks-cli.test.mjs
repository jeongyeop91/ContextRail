import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
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

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-codex-cli-'));
  const home = join(root, 'home');
  const target = join(root, 'project');
  const bin = join(root, 'bin');
  const nodePath = join(bin, 'node');
  const cliPath = join(bin, 'contextrail.mjs');
  await mkdir(join(home, '.codex'), { recursive: true });
  await mkdir(bin, { recursive: true });
  await writeFile(nodePath, 'synthetic node');
  await writeFile(cliPath, 'synthetic cli');
  await writeFile(join(home, '.codex/hooks.json'), `${JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: '/opt/user/stop' }] }] } }, null, 2)}\n`);
  await writeFile(join(home, '.codex/config.toml'), '[features]\nhooks = false\n');
  const initialized = capture();
  assert.equal(await run(['init', '--target', target, '--apply', '--json'], initialized.io), 0);
  return { root, home, target, nodePath, cliPath };
}

function dependencies(scope, extra = {}) {
  return { home: scope.home, nodePath: scope.nodePath, cliPath: scope.cliPath, ...extra };
}

test('hooks install is plan-first, explicitly applies, verifies smoke, and uninstalls only owned entries', async () => {
  const scope = await fixture();
  const before = await readFile(join(scope.home, '.codex/hooks.json'), 'utf8');
  const dryRun = capture();
  assert.equal(await run(['hooks', 'install', '--host', 'codex', '--dry-run', '--json'], dryRun.io, dependencies(scope)), 0);
  const plan = JSON.parse(dryRun.output().stdout);
  assert.equal(plan.status, 'planned');
  assert.equal(plan.applyRequired, true);
  assert.ok(plan.entries.every((entry) => entry.commandWindows.startsWith("& '")));
  assert.equal('before' in plan, false);
  assert.equal('after' in plan, false);
  assert.equal(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8'), before);

  const apply = capture();
  assert.equal(await run(['hooks', 'install', '--host', 'codex', '--apply', '--json'], apply.io, dependencies(scope)), 0, apply.output().stderr);
  assert.equal(JSON.parse(apply.output().stdout).status, 'installed');

  const verify = capture();
  assert.equal(await run(['hooks', 'verify', '--host', 'codex', '--target', scope.target, '--json'], verify.io, dependencies(scope)), 0, verify.output().stderr);
  const report = JSON.parse(verify.output().stdout);
  assert.equal(report.state, 'registered');
  assert.deepEqual(report.smoke, { route: 'passed', continue: 'passed', check: 'passed' });
  assert.equal(report.contextInjection, 'unverified');

  const uninstall = capture();
  assert.equal(await run(['hooks', 'uninstall', '--host', 'codex', '--apply', '--json'], uninstall.io, dependencies(scope)), 0, uninstall.output().stderr);
  assert.equal(JSON.parse(uninstall.output().stdout).status, 'uninstalled');
  assert.equal(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8'), before);
});

test('project automation enable and disable require an explicit write boundary', async () => {
  const scope = await fixture();
  const configPath = join(scope.target, '.context-rail/config.json');
  const before = await readFile(configPath, 'utf8');
  const dryRun = capture();
  assert.equal(await run(['automation', 'enable', '--host', 'codex', '--target', scope.target, '--dry-run', '--json'], dryRun.io), 0);
  assert.equal(JSON.parse(dryRun.output().stdout).summary.enabled, true);
  assert.equal(await readFile(configPath, 'utf8'), before);

  const apply = capture();
  assert.equal(await run(['automation', 'enable', '--host', 'codex', '--target', scope.target, '--apply', '--json'], apply.io), 0, apply.output().stderr);
  assert.equal(JSON.parse(await readFile(configPath, 'utf8')).automation.codex.enabled, true);

  const disable = capture();
  assert.equal(await run(['automation', 'disable', '--host', 'codex', '--target', scope.target, '--apply', '--json'], disable.io), 0);
  const disabled = JSON.parse(await readFile(configPath, 'utf8')).automation.codex;
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.promptRouting, true);
  assert.equal(disabled.stopCheck, true);
});

test('internal Hook commands dispatch stdin without echoing prompts and always fail open', async () => {
  const scope = await fixture();
  const enable = capture();
  assert.equal(await run(['automation', 'enable', '--host', 'codex', '--target', scope.target, '--apply', '--json'], enable.io), 0);
  const rawPrompt = 'please inspect secret-widget-phrase';
  const prompt = capture();
  const promptCode = await run(['hook', 'user-prompt-submit'], prompt.io, {
    hookInput: JSON.stringify({ cwd: scope.target, prompt: rawPrompt }),
  });
  assert.equal(promptCode, 0);
  const routed = JSON.parse(prompt.output().stdout);
  assert.equal(routed.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.equal(prompt.output().stdout.includes(rawPrompt), false);

  const stop = capture();
  assert.equal(await run(['hook', 'stop'], stop.io, {
    hookInput: JSON.stringify({
      session_id: 'thread-sensitive-id',
      cwd: scope.target,
      last_assistant_message: '3973 private response',
    }),
  }), 0);
  assert.equal(stop.output().stdout, '{}\n');
  const marker = await readFile(join(scope.target, '.context-rail/runtime/codex-hook-events.json'), 'utf8');
  assert.match(marker, /"event": "Stop"/);
  assert.doesNotMatch(marker, /thread-sensitive-id|3973/);

  const malformed = capture();
  assert.equal(await run(['hook', 'stop'], malformed.io, { hookInput: '{not-json' }), 0);
  assert.match(JSON.parse(malformed.output().stdout).systemMessage, /continuing without blocking/i);
  assert.equal(malformed.output().stderr, '');
});

test('Codex hook and automation commands reject unsupported hosts and ambiguous apply flags', async () => {
  const scope = await fixture();
  for (const args of [
    ['hooks', 'install', '--host', 'other', '--dry-run', '--json'],
    ['hooks', 'install', '--host', 'codex', '--json'],
    ['hooks', 'uninstall', '--host', 'codex', '--dry-run', '--apply', '--json'],
    ['automation', 'enable', '--host', 'codex', '--target', scope.target, '--json'],
  ]) {
    const stream = capture();
    assert.equal(await run(args, stream.io, dependencies(scope)), 2);
    assert.notEqual(stream.output().stderr, '');
  }
});
