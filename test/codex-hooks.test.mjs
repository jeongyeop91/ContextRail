import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import {
  applyCodexHooksInstall,
  applyCodexHooksUninstall,
  encodePosixCommand,
  encodePowerShellCommand,
  planCodexHooksInstall,
  planCodexHooksUninstall,
  verifyCodexHooks,
} from '../src/integrations/codex-hooks.mjs';

const RECEIPT = '.codex/contextrail/hooks-receipt.json';

test('encodes portable Hook argv for POSIX and PowerShell without interpolation', () => {
  const argv = ["/Applications/Node's Runtime/node", '/프로젝트/CLI & tools/contextrail.mjs', 'hook', 'stop'];
  assert.equal(
    encodePosixCommand(argv),
    "'/Applications/Node'\\''s Runtime/node' '/프로젝트/CLI & tools/contextrail.mjs' 'hook' 'stop'",
  );
  assert.equal(
    encodePowerShellCommand(argv),
    "& '/Applications/Node''s Runtime/node' '/프로젝트/CLI & tools/contextrail.mjs' 'hook' 'stop'",
  );
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-codex-hooks-'));
  const home = join(root, 'home');
  const bin = join(root, 'bin with spaces');
  const nodePath = join(bin, 'node');
  const cliPath = join(bin, 'contextrail.mjs');
  await mkdir(join(home, '.codex'), { recursive: true });
  await mkdir(bin, { recursive: true });
  await writeFile(nodePath, 'synthetic node');
  await writeFile(cliPath, 'synthetic cli');
  const throughlinePrompt = { hooks: [{ type: 'command', command: '/opt/throughline prompt', timeout: 5 }] };
  const throughlineTool = { matcher: 'Bash', hooks: [{ type: 'command', command: '/opt/throughline tool' }] };
  const throughlineStop = { hooks: [{ type: 'command', command: '/opt/throughline stop', timeout: 5 }] };
  const userStop = { hooks: [{ type: 'command', command: '/opt/user/check', timeout: 9 }] };
  const hooks = {
    description: 'Synthetic existing hooks',
    hooks: {
      UserPromptSubmit: [throughlinePrompt],
      PostToolUse: [throughlineTool],
      Stop: [throughlineStop, userStop],
    },
  };
  const config = '[features]\ncodex_hooks = true\nhooks = false\n\n[history]\npersistence = "save-all"\n';
  await writeFile(join(home, '.codex/hooks.json'), `${JSON.stringify(hooks, null, 2)}\n`);
  await writeFile(join(home, '.codex/config.toml'), config);
  return { root, home, nodePath, cliPath, hooks, config };
}

function contextRailHandlers(hooks, event) {
  return (hooks.hooks[event] ?? []).flatMap((group) => group.hooks ?? [group]).filter((handler) =>
    handler.statusMessage?.startsWith('ContextRail:')
  );
}

async function installThenRecordCodexTrust(scope) {
  const configPath = join(scope.home, '.codex/config.toml');
  await writeFile(configPath, scope.config.replace('hooks = false', 'hooks = true'));
  const install = await planCodexHooksInstall({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    fs: nodeFilesystem,
  });
  await applyCodexHooksInstall(install, { fs: nodeFilesystem });
  const trustedConfig = `${await readFile(configPath, 'utf8')}\n[hooks.state.'C:\\Users\\pilot\\.codex\\hooks.json:stop:0:0']\ntrusted_hash = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n`;
  await writeFile(configPath, trustedConfig);
  return trustedConfig;
}

test('install dry-run plans absolute synchronous hooks and changes no HOME file', async () => {
  const scope = await fixture();
  const beforeHooks = await readFile(join(scope.home, '.codex/hooks.json'), 'utf8');
  const beforeConfig = await readFile(join(scope.home, '.codex/config.toml'), 'utf8');
  const plan = await planCodexHooksInstall({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    fs: nodeFilesystem,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.status, 'planned');
  assert.deepEqual(plan.files.map((entry) => entry.path), [
    '.codex/hooks.json',
    '.codex/config.toml',
    RECEIPT,
  ]);
  assert.match(plan.hashes.hooksAfter, /^[a-f\d]{64}$/);
  assert.match(plan.hashes.configAfter, /^[a-f\d]{64}$/);
  assert.doesNotMatch(plan.after.config, /^\s*codex_hooks\s*=/m);
  assert.match(plan.after.config, /^hooks = true$/m);
  assert.match(plan.after.config, /\[history\]\npersistence = "save-all"/);
  assert.equal(plan.receipt.migrationEdit.type, 'normalize');
  for (const entry of plan.entries) {
    const handler = entry.group.hooks[0];
    const eventName = entry.event === 'UserPromptSubmit' ? 'user-prompt-submit' : 'stop';
    assert.equal(handler.command, encodePosixCommand([scope.nodePath, scope.cliPath, 'hook', eventName]));
    assert.match(handler.commandWindows, /^& '/);
    assert.match(handler.commandWindows, /'hook' '(?:user-prompt-submit|stop)'$/);
    assert.equal(Number.isInteger(handler.timeout), true);
    assert.equal('async' in handler, false);
  }
  assert.equal(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8'), beforeHooks);
  assert.equal(await readFile(join(scope.home, '.codex/config.toml'), 'utf8'), beforeConfig);
  assert.equal(await nodeFilesystem.exists(join(scope.home, RECEIPT)), false);
});

test('install apply preserves Throughline and user hooks and is idempotent', async () => {
  const scope = await fixture();
  const plan = await planCodexHooksInstall({ home: scope.home, nodePath: scope.nodePath, cliPath: scope.cliPath, fs: nodeFilesystem });
  const applied = await applyCodexHooksInstall(plan, { fs: nodeFilesystem });
  assert.equal(applied.status, 'installed');

  const hooks = JSON.parse(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8'));
  assert.deepEqual(hooks.hooks.UserPromptSubmit[0], scope.hooks.hooks.UserPromptSubmit[0]);
  assert.deepEqual(hooks.hooks.PostToolUse, scope.hooks.hooks.PostToolUse);
  assert.deepEqual(hooks.hooks.Stop.slice(0, 2), scope.hooks.hooks.Stop);
  assert.equal(contextRailHandlers(hooks, 'UserPromptSubmit').length, 1);
  assert.equal(contextRailHandlers(hooks, 'Stop').length, 1);
  assert.match(await readFile(join(scope.home, '.codex/config.toml'), 'utf8'), /^hooks = true$/m);
  assert.doesNotMatch(await readFile(join(scope.home, '.codex/config.toml'), 'utf8'), /^\s*codex_hooks\s*=/m);
  assert.equal(await nodeFilesystem.exists(join(scope.home, RECEIPT)), true);

  const repeatedPlan = await planCodexHooksInstall({ home: scope.home, nodePath: scope.nodePath, cliPath: scope.cliPath, fs: nodeFilesystem });
  assert.equal(repeatedPlan.status, 'already_installed');
  const repeated = await applyCodexHooksInstall(repeatedPlan, { fs: nodeFilesystem });
  assert.equal(repeated.status, 'already_installed');
  const repeatedHooks = JSON.parse(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8'));
  assert.equal(contextRailHandlers(repeatedHooks, 'UserPromptSubmit').length, 1);
  assert.equal(contextRailHandlers(repeatedHooks, 'Stop').length, 1);
});

test('Codex trust state remains receipt-current when ContextRail did not edit config', async () => {
  const scope = await fixture();
  await installThenRecordCodexTrust(scope);

  const repeatedPlan = await planCodexHooksInstall({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    fs: nodeFilesystem,
  });
  assert.equal(repeatedPlan.ok, true);
  assert.equal(repeatedPlan.status, 'already_installed');

  const report = await verifyCodexHooks({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    fs: nodeFilesystem,
  });
  assert.equal(report.state, 'registered');
  assert.equal(report.receipt, 'current');
});

test('repeated install refreshes its receipt after a non-owned Throughline Hook replacement', async () => {
  const scope = await fixture();
  const firstPlan = await planCodexHooksInstall({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    fs: nodeFilesystem,
  });
  await applyCodexHooksInstall(firstPlan, { fs: nodeFilesystem });
  const hooksPath = join(scope.home, '.codex/hooks.json');
  const hooks = JSON.parse(await readFile(hooksPath, 'utf8'));
  hooks.hooks.Stop[0].hooks[0].command = '/opt/throughline-v2 stop';
  const replacedHooks = `${JSON.stringify(hooks, null, 2)}\n`;
  await writeFile(hooksPath, replacedHooks);

  const refreshPlan = await planCodexHooksInstall({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    fs: nodeFilesystem,
  });

  assert.equal(refreshPlan.ok, true);
  assert.equal(refreshPlan.status, 'planned');
  assert.deepEqual(refreshPlan.files.map(({ action }) => action), ['skip', 'skip', 'update']);
  const renamedTo = [];
  const trackingFilesystem = {
    ...nodeFilesystem,
    async rename(from, to) {
      renamedTo.push(to);
      return nodeFilesystem.rename(from, to);
    },
  };
  await applyCodexHooksInstall(refreshPlan, { fs: trackingFilesystem });
  assert.deepEqual(renamedTo, [join(scope.home, RECEIPT)]);
  assert.equal(await readFile(hooksPath, 'utf8'), replacedHooks);
  const report = await verifyCodexHooks({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    fs: nodeFilesystem,
  });
  assert.equal(report.state, 'registered');
  assert.equal(report.receipt, 'current');
  assert.equal(report.nonOwnedHooks, 'preserved');
});

test('external config changes cannot disable Hooks under a receipt with no feature edit', async () => {
  const scope = await fixture();
  const trustedConfig = await installThenRecordCodexTrust(scope);
  await writeFile(
    join(scope.home, '.codex/config.toml'),
    trustedConfig.replace(/^hooks = true$/m, 'hooks = false'),
  );

  const repeatedPlan = await planCodexHooksInstall({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    fs: nodeFilesystem,
  });
  assert.equal(repeatedPlan.ok, false);
  assert.equal(repeatedPlan.issues[0].code, 'CODEX_HOOK_CONCURRENT_CHANGE');
});

test('receipt refresh still refuses a changed ContextRail-owned Hook', async () => {
  const scope = await fixture();
  const install = await planCodexHooksInstall({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    fs: nodeFilesystem,
  });
  await applyCodexHooksInstall(install, { fs: nodeFilesystem });
  const hooksPath = join(scope.home, '.codex/hooks.json');
  const hooks = JSON.parse(await readFile(hooksPath, 'utf8'));
  contextRailHandlers(hooks, 'Stop')[0].timeout = 31;
  await writeFile(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);

  const repeatedPlan = await planCodexHooksInstall({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    fs: nodeFilesystem,
  });

  assert.equal(repeatedPlan.ok, false);
  assert.equal(repeatedPlan.issues[0].code, 'CODEX_HOOK_CONCURRENT_CHANGE');
});

test('uninstall preserves Codex trust state when ContextRail did not edit config', async () => {
  const scope = await fixture();
  const trustedConfig = await installThenRecordCodexTrust(scope);

  const plan = await planCodexHooksUninstall({ home: scope.home, fs: nodeFilesystem });
  assert.equal(plan.ok, true);
  assert.equal(plan.status, 'planned');
  await applyCodexHooksUninstall(plan, { fs: nodeFilesystem });
  assert.equal(await readFile(join(scope.home, '.codex/config.toml'), 'utf8'), trustedConfig);
});

test('install rolls back every HOME file when a transactional rename fails', async () => {
  const scope = await fixture();
  const beforeHooks = await readFile(join(scope.home, '.codex/hooks.json'), 'utf8');
  const beforeConfig = await readFile(join(scope.home, '.codex/config.toml'), 'utf8');
  const plan = await planCodexHooksInstall({ home: scope.home, nodePath: scope.nodePath, cliPath: scope.cliPath, fs: nodeFilesystem });
  let renames = 0;
  const failingFilesystem = {
    ...nodeFilesystem,
    async rename(from, to) {
      renames += 1;
      if (renames === 2) throw new Error('synthetic config rename failure');
      return nodeFilesystem.rename(from, to);
    },
  };

  await assert.rejects(
    applyCodexHooksInstall(plan, { fs: failingFilesystem }),
    /synthetic config rename failure/,
  );
  assert.equal(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8'), beforeHooks);
  assert.equal(await readFile(join(scope.home, '.codex/config.toml'), 'utf8'), beforeConfig);
  assert.equal(await nodeFilesystem.exists(join(scope.home, RECEIPT)), false);
});

test('uninstall removes only owned entries and preserves canonical pre-install feature semantics', async () => {
  const scope = await fixture();
  const install = await planCodexHooksInstall({ home: scope.home, nodePath: scope.nodePath, cliPath: scope.cliPath, fs: nodeFilesystem });
  await applyCodexHooksInstall(install, { fs: nodeFilesystem });

  const plan = await planCodexHooksUninstall({ home: scope.home, fs: nodeFilesystem });
  assert.equal(plan.ok, true);
  assert.equal(plan.status, 'planned');
  const result = await applyCodexHooksUninstall(plan, { fs: nodeFilesystem });
  assert.equal(result.status, 'uninstalled');
  assert.deepEqual(JSON.parse(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8')), scope.hooks);
  const config = await readFile(join(scope.home, '.codex/config.toml'), 'utf8');
  assert.doesNotMatch(config, /^\s*codex_hooks\s*=/m);
  assert.match(config, /^hooks = false$/m);
  assert.match(config, /\[history\]\npersistence = "save-all"/);
  assert.equal(await nodeFilesystem.exists(join(scope.home, RECEIPT)), false);
});

test('legacy-only true migrates to canonical true and uninstall does not restore the deprecated key', async () => {
  const scope = await fixture();
  const configPath = join(scope.home, '.codex/config.toml');
  await writeFile(configPath, '[features]\n  codex_hooks = true # keep comment\n\n[history]\npersistence = "save-all"\n');

  const install = await planCodexHooksInstall({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    fs: nodeFilesystem,
  });
  assert.equal(install.status, 'planned');
  assert.match(install.after.config, /^  hooks = true # keep comment$/m);
  assert.doesNotMatch(install.after.config, /codex_hooks/);
  assert.equal(install.receipt.featureEdit.type, 'none');
  await applyCodexHooksInstall(install, { fs: nodeFilesystem });

  const uninstall = await planCodexHooksUninstall({ home: scope.home, fs: nodeFilesystem });
  assert.equal(uninstall.ok, true);
  await applyCodexHooksUninstall(uninstall, { fs: nodeFilesystem });
  const config = await readFile(configPath, 'utf8');
  assert.match(config, /^  hooks = true # keep comment$/m);
  assert.doesNotMatch(config, /codex_hooks/);
});

test('canonical hooks wins over a conflicting legacy key while trust sections stay byte-preserved', async () => {
  const scope = await fixture();
  const configPath = join(scope.home, '.codex/config.toml');
  const trust = "[hooks.state.'C:\\Users\\pilot\\.codex\\hooks.json:stop:0:0']\ntrusted_hash = \"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"\n";
  await writeFile(configPath, `[features]\ncodex_hooks = false\nhooks = true\n\n${trust}`);

  const install = await planCodexHooksInstall({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    fs: nodeFilesystem,
  });
  assert.equal(install.status, 'planned');
  assert.doesNotMatch(install.after.config, /codex_hooks/);
  assert.match(install.after.config, /^hooks = true$/m);
  assert.match(install.after.config, new RegExp(trust.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(install.receipt.featureEdit.type, 'none');
});

test('uninstall refuses concurrent Hook changes after installation', async () => {
  const scope = await fixture();
  const install = await planCodexHooksInstall({ home: scope.home, nodePath: scope.nodePath, cliPath: scope.cliPath, fs: nodeFilesystem });
  await applyCodexHooksInstall(install, { fs: nodeFilesystem });
  const hooksPath = join(scope.home, '.codex/hooks.json');
  const hooks = JSON.parse(await readFile(hooksPath, 'utf8'));
  hooks.hooks.Stop.push({ hooks: [{ type: 'command', command: '/opt/user/added-later' }] });
  await writeFile(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);

  const plan = await planCodexHooksUninstall({ home: scope.home, fs: nodeFilesystem });
  assert.equal(plan.ok, false);
  assert.equal(plan.issues[0].code, 'CODEX_HOOK_CONCURRENT_CHANGE');
  assert.ok(hooks.hooks.Stop.some((group) => JSON.stringify(group).includes('added-later')));
});

test('verify distinguishes exact registration, preservation, project automation, and smoke evidence', async () => {
  const scope = await fixture();
  const install = await planCodexHooksInstall({ home: scope.home, nodePath: scope.nodePath, cliPath: scope.cliPath, fs: nodeFilesystem });
  await applyCodexHooksInstall(install, { fs: nodeFilesystem });

  const report = await verifyCodexHooks({
    home: scope.home,
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    projectAutomation: { enabled: false, projectRoot: null },
    smoke: { route: 'passed', continue: 'passed', check: 'passed' },
    fs: nodeFilesystem,
  });
  assert.equal(report.state, 'registered');
  assert.equal(report.entries.userPromptSubmit, 'ready');
  assert.equal(report.entries.stop, 'ready');
  assert.equal(report.nonOwnedHooks, 'preserved');
  assert.equal(report.featureFlag, 'enabled');
  assert.equal(report.projectAutomation.enabled, false);
  assert.deepEqual(report.smoke, { route: 'passed', continue: 'passed', check: 'passed' });
  assert.equal(report.contextInjection, 'unverified');
});

test('verify reports duplicate ContextRail handlers instead of claiming readiness', async () => {
  const scope = await fixture();
  const install = await planCodexHooksInstall({ home: scope.home, nodePath: scope.nodePath, cliPath: scope.cliPath, fs: nodeFilesystem });
  await applyCodexHooksInstall(install, { fs: nodeFilesystem });
  const hooksPath = join(scope.home, '.codex/hooks.json');
  const hooks = JSON.parse(await readFile(hooksPath, 'utf8'));
  hooks.hooks.Stop.push(structuredClone(hooks.hooks.Stop.at(-1)));
  await writeFile(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);

  const report = await verifyCodexHooks({ home: scope.home, nodePath: scope.nodePath, cliPath: scope.cliPath, fs: nodeFilesystem });
  assert.equal(report.state, 'conflict');
  assert.equal(report.entries.stop, 'duplicate');
});
