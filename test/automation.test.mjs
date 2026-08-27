import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { applyProjectAutomation, codexAutomation, planProjectAutomation } from '../src/core/automation.mjs';

const CONFIG_PATH = '.context-rail/config.json';
const VERSION_PATH = '.context-rail/version.json';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-automation-'));
  await mkdir(join(root, '.context-rail'), { recursive: true });
  const config = {
    schema: 1,
    documentRouter: 'docs/README.md',
    authorityDirectory: 'docs/authority',
    state: { current: 'state/CURRENT.md', plan: 'state/PLAN.md', backlog: 'state/BACKLOG.json' },
    limits: { routerLines: 50, authorityLines: 500 },
    instructionsFile: 'AGENTS.md',
  };
  const configText = `${JSON.stringify(config, null, 2)}\n`;
  const version = {
    schema: 1,
    templateVersion: '0.1.0',
    ownedFiles: { [CONFIG_PATH]: sha256(configText) },
  };
  await writeFile(join(root, CONFIG_PATH), configText);
  await writeFile(join(root, VERSION_PATH), `${JSON.stringify(version, null, 2)}\n`);
  return { root, configText };
}

test('missing Codex automation defaults to disabled without changing the config', () => {
  const config = { schema: 1 };
  assert.deepEqual(codexAutomation(config), { enabled: false, promptRouting: false, stopCheck: false });
  assert.deepEqual(config, { schema: 1 });
});

test('enable is plan-first and atomically records the new owned config hash', async () => {
  const scope = await fixture();
  const beforeVersion = await readFile(join(scope.root, VERSION_PATH), 'utf8');
  const plan = await planProjectAutomation({ target: scope.root, enabled: true, fs: nodeFilesystem });

  assert.equal(plan.ok, true);
  assert.deepEqual(plan.operations.map((entry) => entry.path), [CONFIG_PATH, VERSION_PATH]);
  assert.equal(await readFile(join(scope.root, CONFIG_PATH), 'utf8'), scope.configText);
  assert.equal(await readFile(join(scope.root, VERSION_PATH), 'utf8'), beforeVersion);

  await applyProjectAutomation(plan, nodeFilesystem);
  const configText = await readFile(join(scope.root, CONFIG_PATH), 'utf8');
  const config = JSON.parse(configText);
  const version = JSON.parse(await readFile(join(scope.root, VERSION_PATH), 'utf8'));
  assert.deepEqual(config.automation.codex, { enabled: true, promptRouting: true, stopCheck: true });
  assert.equal(version.ownedFiles[CONFIG_PATH], sha256(configText));
});

test('disable keeps route and check preferences while turning project automation off', async () => {
  const scope = await fixture();
  const enabledPlan = await planProjectAutomation({ target: scope.root, enabled: true, fs: nodeFilesystem });
  await applyProjectAutomation(enabledPlan, nodeFilesystem);

  const disabledPlan = await planProjectAutomation({ target: scope.root, enabled: false, fs: nodeFilesystem });
  await applyProjectAutomation(disabledPlan, nodeFilesystem);
  assert.deepEqual(JSON.parse(await readFile(join(scope.root, CONFIG_PATH), 'utf8')).automation.codex, {
    enabled: false,
    promptRouting: true,
    stopCheck: true,
  });
});

test('automation refuses a config whose current hash is not owned', async () => {
  const scope = await fixture();
  const config = JSON.parse(scope.configText);
  config.userChange = true;
  await writeFile(join(scope.root, CONFIG_PATH), `${JSON.stringify(config, null, 2)}\n`);

  const plan = await planProjectAutomation({ target: scope.root, enabled: true, fs: nodeFilesystem });
  assert.equal(plan.ok, false);
  assert.equal(plan.issues[0].code, 'AUTOMATION_CONFIG_NOT_OWNED');
});

test('apply refuses a concurrent version change made after planning', async () => {
  const scope = await fixture();
  const plan = await planProjectAutomation({ target: scope.root, enabled: true, fs: nodeFilesystem });
  await writeFile(join(scope.root, VERSION_PATH), '{"concurrent":true}\n');

  await assert.rejects(() => applyProjectAutomation(plan, nodeFilesystem), /concurrent change/);
  assert.equal(await readFile(join(scope.root, CONFIG_PATH), 'utf8'), scope.configText);
});

test('failed second rename restores both automation files', async () => {
  const scope = await fixture();
  const beforeVersion = await readFile(join(scope.root, VERSION_PATH), 'utf8');
  const plan = await planProjectAutomation({ target: scope.root, enabled: true, fs: nodeFilesystem });
  let failed = false;
  const fs = {
    ...nodeFilesystem,
    async rename(from, to) {
      if (!failed && to.endsWith(VERSION_PATH)) {
        failed = true;
        throw new Error('synthetic version rename failure');
      }
      return nodeFilesystem.rename(from, to);
    },
  };

  await assert.rejects(() => applyProjectAutomation(plan, fs), /synthetic version rename failure/);
  assert.equal(await readFile(join(scope.root, CONFIG_PATH), 'utf8'), scope.configText);
  assert.equal(await readFile(join(scope.root, VERSION_PATH), 'utf8'), beforeVersion);
});
