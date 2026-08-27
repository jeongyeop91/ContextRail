import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { applySetup, planSetup, verifySetup } from '../src/integrations/setup.mjs';

const TEMPLATE_ROOT = resolve('templates/project');
const artifactBytes = Buffer.from('synthetic patched Throughline artifact');
const artifactSha256 = createHash('sha256').update(artifactBytes).digest('hex');

async function fixture({ existing = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-setup-integration-'));
  const target = join(root, 'Project 한글');
  const home = join(root, 'Home With Spaces');
  const managedRoot = join(root, 'Managed Data', 'throughline');
  const nodePath = join(root, 'Node Runtime', 'node');
  const cliPath = join(root, 'CLI Tools', 'contextrail.mjs');
  await mkdir(join(home, '.codex'), { recursive: true });
  await mkdir(dirname(nodePath), { recursive: true });
  await mkdir(dirname(cliPath), { recursive: true });
  await writeFile(nodePath, 'synthetic node');
  await writeFile(cliPath, 'synthetic cli');
  await writeFile(join(home, '.codex/hooks.json'), `${JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'user-owned-stop' }] }] } }, null, 2)}\n`);
  await writeFile(join(home, '.codex/config.toml'), '[features]\nhooks = false\n');
  if (existing) {
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'README.md'), '# Existing project\n');
  }
  const setupManifest = JSON.parse(await readFile(resolve('integrations/setup-manifest.json'), 'utf8'));
  setupManifest.throughline.artifact.sha256 = artifactSha256;
  const calls = [];
  const processAdapter = {
    async run(executable, args) {
      calls.push([executable, ...args]);
      if (executable === 'npm') {
        const prefix = args[args.indexOf('--prefix') + 1];
        const packageRoot = join(prefix, 'node_modules/throughline');
        await mkdir(join(packageRoot, 'bin'), { recursive: true });
        await writeFile(join(packageRoot, 'package.json'), JSON.stringify({ name: 'throughline', bin: { throughline: 'bin/cli.mjs' } }));
        await writeFile(join(packageRoot, 'bin/cli.mjs'), 'export {};');
        return { code: 0, stdout: '', stderr: '' };
      }
      const command = executable === nodePath ? args[1] : args[0];
      if (command === '--version') return { code: 0, stdout: '0.10.3-codex.1\n', stderr: '' };
      if (command === 'install') {
        const hooksPath = join(home, '.codex/hooks.json');
        const hooks = JSON.parse(await readFile(hooksPath, 'utf8'));
        hooks.hooks.Stop.push({ hooks: [{ type: 'command', command: 'managed-throughline-stop' }] });
        await writeFile(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);
        return { code: 0, stdout: '', stderr: '' };
      }
      if (command === 'factory-diagnostics') return {
        code: 0,
        stdout: JSON.stringify({ schema: 'throughline.native_factory_diagnostics.v1', overall: { status: 'ready' }, hooks: { status: 'ready' }, readiness: {} }),
        stderr: '',
      };
      return { code: 0, stdout: '', stderr: '' };
    },
  };
  let downloads = 0;
  const downloadArtifact = async ({ destination, fs }) => {
    downloads += 1;
    await fs.mkdir(dirname(destination), { recursive: true });
    await fs.writeBytes(destination, artifactBytes);
    return { path: destination, sha256: artifactSha256, bytes: artifactBytes.length };
  };
  return {
    root, target, home, managedRoot, nodePath, cliPath, setupManifest, calls, processAdapter, downloadArtifact,
    downloads: () => downloads,
  };
}

function dependencies(scope) {
  return {
    target: scope.target,
    input: {},
    home: scope.home,
    managedRoot: scope.managedRoot,
    platform: 'linux',
    env: {},
    nodePath: scope.nodePath,
    cliPath: scope.cliPath,
    templateRoot: TEMPLATE_ROOT,
    setupManifest: scope.setupManifest,
    fs: nodeFilesystem,
    processAdapter: scope.processAdapter,
    downloadArtifact: scope.downloadArtifact,
    tempRoot: scope.root,
  };
}

test('full dry-run discovers and plans without downloads, processes, target writes, or HOME changes', async () => {
  const scope = await fixture();
  const homeBefore = await readFile(join(scope.home, '.codex/hooks.json'), 'utf8');
  const planned = await planSetup(dependencies(scope));
  assert.equal(planned.plan.status, 'planned');
  assert.deepEqual(planned.plan.steps.map(({ id }) => id), ['throughline', 'project', 'context_hooks', 'automation', 'verify']);
  assert.equal(scope.downloads(), 0);
  assert.deepEqual(scope.calls, []);
  assert.equal(await nodeFilesystem.exists(scope.target), false);
  assert.equal(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8'), homeBefore);
});

test('existing repositories return needs_input and candidate paths without guessing mappings', async () => {
  const scope = await fixture({ existing: true });
  const planned = await planSetup(dependencies(scope));
  assert.equal(planned.plan.status, 'needs_input');
  assert.deepEqual(planned.plan.project.candidates, ['README.md']);
  assert.equal(scope.downloads(), 0);
});

test('full apply installs Throughline, initializes the project, appends ContextRail Hooks, enables automation, and records resumable state', async () => {
  const scope = await fixture();
  const planned = await planSetup(dependencies(scope));
  const result = await applySetup({ planned, approvedPlanId: planned.plan.id, dependencies: dependencies(scope) });
  assert.equal(result.status, 'installed_live_verification_required');
  assert.equal(scope.downloads(), 1);
  assert.equal(JSON.parse(await readFile(join(scope.target, '.context-rail/config.json'), 'utf8')).automation.codex.enabled, true);
  const hooks = JSON.parse(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8'));
  assert.ok(JSON.stringify(hooks).includes('managed-throughline-stop'));
  assert.ok(JSON.stringify(hooks).includes('ContextRail: routing project context'));
  const receipt = JSON.parse(await readFile(join(scope.target, '.context-rail/runtime/setup-receipt.json'), 'utf8'));
  assert.equal(receipt.planId, planned.plan.id);
  assert.equal(receipt.steps.every(({ status }) => status === 'completed'), true);

  const report = await verifySetup({ ...dependencies(scope), liveEvidence: null });
  assert.equal(report.status, 'installed_live_verification_required');
  assert.equal(report.live.throughline, 'unverified');
});

test('core-only apply never downloads or changes HOME', async () => {
  const scope = await fixture();
  const input = { coreOnly: true };
  const deps = { ...dependencies(scope), input };
  const homeBefore = await readFile(join(scope.home, '.codex/hooks.json'), 'utf8');
  const planned = await planSetup(deps);
  assert.deepEqual(planned.plan.steps.map(({ id }) => id), ['project', 'verify']);
  const result = await applySetup({ planned, approvedPlanId: planned.plan.id, dependencies: deps });
  assert.equal(result.status, 'installed');
  assert.equal(scope.downloads(), 0);
  assert.deepEqual(scope.calls, []);
  assert.equal(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8'), homeBefore);
});

test('memory-without-context-Hooks installs Throughline but omits ContextRail Hooks and automation', async () => {
  const scope = await fixture();
  const deps = { ...dependencies(scope), input: { noContextHooks: true } };
  const planned = await planSetup(deps);
  assert.deepEqual(planned.plan.steps.map(({ id }) => id), ['throughline', 'project', 'verify']);
  const result = await applySetup({ planned, approvedPlanId: planned.plan.id, dependencies: deps });
  assert.equal(result.status, 'installed_live_verification_required');
  const hooks = await readFile(join(scope.home, '.codex/hooks.json'), 'utf8');
  assert.match(hooks, /managed-throughline-stop/);
  assert.equal(hooks.includes('ContextRail:'), false);
  assert.equal(JSON.parse(await readFile(join(scope.target, '.context-rail/config.json'), 'utf8')).automation?.codex?.enabled ?? false, false);
});

test('existing-Throughline profile verifies and preserves the unmanaged binary without downloading', async () => {
  const scope = await fixture();
  const deps = { ...dependencies(scope), input: { useExistingThroughline: true }, existingThroughlineBinary: 'throughline' };
  const planned = await planSetup(deps);
  assert.equal(planned.plan.steps[0].action, 'reuse_existing');
  const result = await applySetup({ planned, approvedPlanId: planned.plan.id, dependencies: deps });
  assert.equal(result.status, 'installed_live_verification_required');
  assert.equal(scope.downloads(), 0);
  assert.equal(scope.calls.some((call) => call[0] === 'npm'), false);
  assert.ok(scope.calls.some((call) => call[0] === 'throughline' && call[1] === '--version'));
});

test('repeat apply verifies completed components and does not download or duplicate Hooks', async () => {
  const scope = await fixture();
  const deps = dependencies(scope);
  const first = await planSetup(deps);
  await applySetup({ planned: first, approvedPlanId: first.plan.id, dependencies: deps });
  const second = await planSetup(deps);
  const result = await applySetup({ planned: second, approvedPlanId: second.plan.id, dependencies: deps });
  assert.equal(result.status, 'installed_live_verification_required');
  assert.equal(scope.downloads(), 1);
  const hooks = JSON.parse(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8'));
  const owned = JSON.stringify(hooks).match(/ContextRail: routing project context/g) ?? [];
  assert.equal(owned.length, 1);
});

test('a failed download reports recoverable component state and leaves project and HOME unchanged', async () => {
  const scope = await fixture();
  const homeBefore = await readFile(join(scope.home, '.codex/hooks.json'), 'utf8');
  const deps = { ...dependencies(scope), downloadArtifact: async () => { throw new Error('synthetic download failure'); } };
  const planned = await planSetup(deps);
  await assert.rejects(
    applySetup({ planned, approvedPlanId: planned.plan.id, dependencies: deps }),
    (error) => {
      assert.match(error.message, /synthetic download failure/);
      assert.equal(error.setup.steps[0].status, 'failed');
      assert.equal(error.setup.steps.slice(1).every(({ status }) => status === 'pending'), true);
      return true;
    },
  );
  assert.equal(await nodeFilesystem.exists(scope.target), false);
  assert.equal(await readFile(join(scope.home, '.codex/hooks.json'), 'utf8'), homeBefore);
});

test('apply refuses an approval for a different plan identity', async () => {
  const scope = await fixture();
  const planned = await planSetup(dependencies(scope));
  await assert.rejects(
    applySetup({ planned, approvedPlanId: '0'.repeat(64), dependencies: dependencies(scope) }),
    /approval does not match/i,
  );
  assert.equal(scope.downloads(), 0);
});
