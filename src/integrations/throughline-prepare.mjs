import { mkdtemp, rm } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

function step(action, executable, args) {
  return { action, executable, args };
}

export function planPreparation(manifest) {
  return {
    status: 'planned',
    baseCommit: manifest.baseCommit,
    patchSha256: manifest.patch.sha256,
    steps: [
      step('clone', 'git', ['clone', '--no-checkout', '--filter=blob:none', manifest.repository, '<worktree>']),
      step('checkout', 'git', ['checkout', '--detach', manifest.baseCommit]),
      step('verify_head', 'git', ['rev-parse', 'HEAD']),
      step('check_patch', 'git', ['apply', '--check', '<patch>']),
      step('apply_patch', 'git', ['apply', '<patch>']),
      ...manifest.tests.map((argv) => step('test', argv[0], argv.slice(1))),
      step('pack', manifest.pack[0], manifest.pack.slice(1)),
    ],
  };
}

async function checked(processAdapter, executable, args, options, message) {
  const result = await processAdapter.run(executable, args, options);
  if (result.code !== 0) throw new Error(`${message}: ${result.stderr.trim() || `exit ${result.code}`}`);
  return result;
}

export async function prepareThroughline({ manifest, integrationRoot, tempParent, fs, processAdapter }) {
  const preparationRoot = await mkdtemp(resolve(tempParent, 'contextrail-throughline-'));
  const worktree = resolve(preparationRoot, 'repository');
  const patchPath = resolve(integrationRoot, manifest.patch.path);
  const evidence = { baseCommit: manifest.baseCommit, patchSha256: manifest.patch.sha256, steps: [] };
  try {
    await checked(processAdapter, 'git', ['clone', '--no-checkout', '--filter=blob:none', manifest.repository, worktree], { cwd: tempParent }, 'Clone failed');
    evidence.steps.push('clone');
    await checked(processAdapter, 'git', ['checkout', '--detach', manifest.baseCommit], { cwd: worktree }, 'Checkout failed');
    evidence.steps.push('checkout');
    const head = await checked(processAdapter, 'git', ['rev-parse', 'HEAD'], { cwd: worktree }, 'HEAD verification failed');
    if (head.stdout.trim() !== manifest.baseCommit) throw new Error(`HEAD mismatch: expected ${manifest.baseCommit}, got ${head.stdout.trim()}`);
    evidence.steps.push('verify_head');
    await checked(processAdapter, 'git', ['apply', '--check', patchPath], { cwd: worktree }, 'Patch check failed');
    evidence.steps.push('check_patch');
    await checked(processAdapter, 'git', ['apply', patchPath], { cwd: worktree }, 'Patch apply failed');
    evidence.steps.push('apply_patch');
    for (const argv of manifest.tests) {
      await checked(processAdapter, argv[0], argv.slice(1), { cwd: worktree, timeoutMs: 120000 }, 'Test command failed');
    }
    evidence.steps.push('test');
    const packed = await checked(processAdapter, manifest.pack[0], manifest.pack.slice(1), { cwd: worktree, timeoutMs: 120000 }, 'Pack failed');
    evidence.steps.push('pack');
    let packageResult;
    try {
      packageResult = JSON.parse(packed.stdout);
    } catch {
      throw new Error('Pack failed: npm did not return JSON');
    }
    const filename = Array.isArray(packageResult) ? packageResult[0]?.filename : packageResult?.filename;
    if (!filename || basename(filename) !== filename) throw new Error('Pack failed: invalid artifact filename');
    return { status: 'prepared', worktree, artifact: resolve(worktree, filename), evidence };
  } catch (error) {
    await rm(preparationRoot, { recursive: true, force: true });
    throw error;
  }
}
