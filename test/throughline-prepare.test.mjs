import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { nodeProcess } from '../src/adapters/process.mjs';
import { planPreparation, prepareThroughline } from '../src/integrations/throughline-prepare.mjs';

const exec = promisify(execFile);

async function fakeUpstream() {
  const container = await mkdtemp(join(tmpdir(), 'contextrail-upstream-'));
  const upstream = join(container, 'upstream');
  await mkdir(upstream);
  await exec('git', ['init', '-b', 'main'], { cwd: upstream });
  await exec('git', ['config', 'user.name', 'Fixture'], { cwd: upstream });
  await exec('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: upstream });
  await writeFile(join(upstream, 'package.json'), JSON.stringify({ name: 'fixture-throughline', version: '1.0.0', type: 'module' }));
  await writeFile(join(upstream, 'value.txt'), 'base\n');
  await exec('git', ['add', '.'], { cwd: upstream });
  await exec('git', ['commit', '-m', 'base'], { cwd: upstream });
  const { stdout: baseCommit } = await exec('git', ['rev-parse', 'HEAD'], { cwd: upstream });
  await writeFile(join(upstream, 'value.txt'), 'compatible\n');
  await exec('git', ['add', 'value.txt'], { cwd: upstream });
  await exec('git', ['commit', '-m', 'compatibility'], { cwd: upstream });
  const { stdout: compatibilityCommit } = await exec('git', ['rev-parse', 'HEAD'], { cwd: upstream });
  const { stdout: patch } = await exec('git', ['format-patch', '--stdout', '--full-index', '--binary', '-1', compatibilityCommit.trim()], { cwd: upstream, maxBuffer: 1024 * 1024 });
  const integrationRoot = join(container, 'context');
  await mkdir(join(integrationRoot, 'patches'), { recursive: true });
  await writeFile(join(integrationRoot, 'patches/change.patch'), patch);
  return {
    container,
    manifest: {
      schema: 1,
      repository: upstream,
      baseCommit: baseCommit.trim(),
      compatibilityCommit: compatibilityCommit.trim(),
      patch: { path: 'patches/change.patch', sha256: createHash('sha256').update(patch).digest('hex') },
      tests: [['node', '-e', 'process.exit(0)']],
      pack: ['npm', 'pack', '--json'],
    },
    integrationRoot,
  };
}

test('plans the bounded preparation sequence without running it', async () => {
  const fixture = await fakeUpstream();
  const plan = planPreparation(fixture.manifest);
  assert.deepEqual(plan.steps.map((entry) => entry.action), ['clone', 'checkout', 'verify_head', 'check_patch', 'apply_patch', 'test', 'pack']);
  assert.equal(await nodeFilesystem.exists(join(fixture.container, 'work')), false);
});

test('checks out, applies, tests, and packs a pinned local upstream', async () => {
  const fixture = await fakeUpstream();
  const result = await prepareThroughline({
    manifest: fixture.manifest,
    integrationRoot: fixture.integrationRoot,
    tempParent: fixture.container,
    fs: nodeFilesystem,
    processAdapter: nodeProcess,
  });
  assert.equal(result.status, 'prepared');
  assert.equal((await readFile(join(result.worktree, 'value.txt'), 'utf8')).trim(), 'compatible');
  assert.match(result.artifact, /fixture-throughline-1\.0\.0\.tgz$/);
  assert.deepEqual(result.evidence.steps, ['clone', 'checkout', 'verify_head', 'check_patch', 'apply_patch', 'test', 'pack']);
});

test('refuses a checkout whose HEAD does not match the pin', async () => {
  const fixture = await fakeUpstream();
  const calls = [];
  const adapter = {
    async run(executable, args) {
      calls.push([executable, ...args]);
      if (executable === 'git' && args[0] === 'rev-parse') return { code: 0, stdout: `${'f'.repeat(40)}\n`, stderr: '' };
      return { code: 0, stdout: '', stderr: '' };
    },
  };
  await assert.rejects(() => prepareThroughline({ manifest: fixture.manifest, integrationRoot: fixture.integrationRoot, tempParent: fixture.container, fs: nodeFilesystem, processAdapter: adapter }), /HEAD mismatch/);
  assert.equal(calls.some((call) => call.includes('apply')), false);
});

test('stops when patch checking or configured tests fail', async () => {
  const fixture = await fakeUpstream();
  for (const failure of ['check', 'test']) {
    const adapter = {
      async run(executable, args) {
        if (executable === 'git' && args[0] === 'rev-parse') return { code: 0, stdout: `${fixture.manifest.baseCommit}\n`, stderr: '' };
        if (failure === 'check' && executable === 'git' && args[0] === 'apply' && args[1] === '--check') return { code: 1, stdout: '', stderr: 'reject' };
        if (failure === 'test' && executable === 'node') return { code: 1, stdout: '', stderr: 'failed' };
        return { code: 0, stdout: executable === 'npm' ? '[{"filename":"artifact.tgz"}]' : '', stderr: '' };
      },
    };
    await assert.rejects(() => prepareThroughline({ manifest: fixture.manifest, integrationRoot: fixture.integrationRoot, tempParent: fixture.container, fs: nodeFilesystem, processAdapter: adapter }), failure === 'check' ? /Patch check failed/ : /Test command failed/);
  }
});
