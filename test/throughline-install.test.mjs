import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { applyManagedInstall, planManagedInstall, rollbackManagedInstall } from '../src/integrations/throughline-install.mjs';

const manifest = {
  repository: 'https://github.com/kitepon/Throughline.git',
  baseCommit: 'a'.repeat(40),
  compatibilityCommit: 'b'.repeat(40),
  patch: { sha256: 'c'.repeat(64) },
};

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-install-'));
  const home = join(root, 'home');
  const managedRoot = join(root, 'managed');
  const artifact = join(root, 'throughline.tgz');
  await mkdir(join(home, '.codex'), { recursive: true });
  await writeFile(join(home, '.codex/hooks.json'), JSON.stringify({ hooks: { Stop: [{ command: 'existing-hook' }] } }));
  await writeFile(artifact, 'artifact');
  return { root, home, managedRoot, artifact };
}

function successfulAdapter(home) {
  return {
    async run(executable, args) {
      if (executable === 'npm') return { code: 0, stdout: '', stderr: '' };
      if (args[0] === '--version') return { code: 0, stdout: '0.10.3-codex.1\n', stderr: '' };
      if (args[0] === 'install') {
        const hooksPath = join(home, '.codex/hooks.json');
        const hooks = JSON.parse(await readFile(hooksPath, 'utf8'));
        hooks.hooks.Stop.push({ command: 'managed-throughline-hook' });
        await writeFile(hooksPath, JSON.stringify(hooks));
        return { code: 0, stdout: '', stderr: '' };
      }
      if (args[0] === 'factory-diagnostics') return {
        code: 0,
        stdout: JSON.stringify({ schema: 'throughline.native_factory_diagnostics.v1', overall: { status: 'ready' }, hooks: { status: 'ready' }, readiness: {} }),
        stderr: '',
      };
      return { code: 0, stdout: '', stderr: '' };
    },
  };
}

test('dry-run planning writes nothing and confines release paths', async () => {
  const scope = await fixture();
  const plan = planManagedInstall({ managedRoot: scope.managedRoot, artifact: scope.artifact, version: '0.10.3-codex.1', manifest });
  assert.equal(await nodeFilesystem.exists(scope.managedRoot), false);
  assert.match(plan.releaseId, /^0\.10\.3-codex\.1-[a-f\d]{12}$/);
  assert.ok(plan.releaseDirectory.startsWith(scope.managedRoot));
  await assert.rejects(() => applyManagedInstall({ plan, apply: false, home: scope.home, fs: nodeFilesystem, processAdapter: successfulAdapter(scope.home) }), /explicit apply/);
});

test('explicit apply preserves unrelated hooks and selects only after verification', async () => {
  const scope = await fixture();
  const plan = planManagedInstall({ managedRoot: scope.managedRoot, artifact: scope.artifact, version: '0.10.3-codex.1', manifest });
  const result = await applyManagedInstall({ plan, apply: true, home: scope.home, fs: nodeFilesystem, processAdapter: successfulAdapter(scope.home) });
  assert.equal(result.status, 'installed');
  const hooks = JSON.parse(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8'));
  assert.ok(hooks.hooks.Stop.some((entry) => entry.command === 'existing-hook'));
  const current = JSON.parse(await readFile(join(scope.managedRoot, 'current.json'), 'utf8'));
  assert.equal(current.releaseId, plan.releaseId);
  const receipt = JSON.parse(await readFile(join(plan.releaseDirectory, 'receipt.json'), 'utf8'));
  assert.equal(receipt.patchSha256, manifest.patch.sha256);
});

test('failed install leaves the previous current selection unchanged', async () => {
  const scope = await fixture();
  await mkdir(scope.managedRoot, { recursive: true });
  await writeFile(join(scope.managedRoot, 'current.json'), JSON.stringify({ releaseId: 'previous' }));
  const plan = planManagedInstall({ managedRoot: scope.managedRoot, artifact: scope.artifact, version: '0.10.3-codex.1', manifest });
  const failing = { run: async () => ({ code: 1, stdout: '', stderr: 'install failed' }) };
  await assert.rejects(() => applyManagedInstall({ plan, apply: true, home: scope.home, fs: nodeFilesystem, processAdapter: failing }), /npm install failed/);
  assert.equal(JSON.parse(await readFile(join(scope.managedRoot, 'current.json'), 'utf8')).releaseId, 'previous');
});

test('rollback refuses concurrent hook changes', async () => {
  const scope = await fixture();
  await mkdir(join(scope.managedRoot, 'releases/current'), { recursive: true });
  await mkdir(join(scope.managedRoot, 'releases/previous'), { recursive: true });
  await writeFile(join(scope.managedRoot, 'current.json'), JSON.stringify({ releaseId: 'current', previousReleaseId: 'previous' }));
  await writeFile(join(scope.managedRoot, 'releases/current/receipt.json'), JSON.stringify({ configAfter: { codexHooks: 'not-current-hash' } }));
  await writeFile(join(scope.managedRoot, 'releases/previous/receipt.json'), JSON.stringify({ releaseId: 'previous' }));
  await assert.rejects(() => rollbackManagedInstall({ managedRoot: scope.managedRoot, apply: true, home: scope.home, fs: nodeFilesystem, processAdapter: successfulAdapter(scope.home) }), /concurrent change/);
});
