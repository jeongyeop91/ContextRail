import { createHash } from 'node:crypto';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

async function optionalText(fs, path) {
  return (await fs.exists(path)) ? fs.readText(path) : null;
}

function contentHash(content) {
  return content === null ? 'absent' : sha256(content);
}

function snapshotHashes(snapshot) {
  return { codexHooks: contentHash(snapshot.codexHooks), codexConfig: contentHash(snapshot.codexConfig) };
}

async function snapshotHome(home, fs) {
  return {
    codexHooks: await optionalText(fs, resolve(home, '.codex/hooks.json')),
    codexConfig: await optionalText(fs, resolve(home, '.codex/config.toml')),
  };
}

async function restoreHome(home, snapshot, fs) {
  for (const [path, content] of [
    [resolve(home, '.codex/hooks.json'), snapshot.codexHooks],
    [resolve(home, '.codex/config.toml'), snapshot.codexConfig],
  ]) {
    if (content === null) await fs.remove(path, { force: true });
    else {
      await fs.mkdir(resolve(path, '..'), { recursive: true });
      await fs.writeText(path, content);
    }
  }
}

function deepSubset(before, after) {
  if (Array.isArray(before)) return Array.isArray(after) && before.every((entry) => after.some((candidate) => JSON.stringify(candidate) === JSON.stringify(entry)));
  if (before && typeof before === 'object') return after && typeof after === 'object' && Object.entries(before).every(([key, value]) => deepSubset(value, after[key]));
  return before === after;
}

async function atomicJson(path, value, fs) {
  const temporary = `${path}.tmp-${process.pid}`;
  await fs.writeText(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporary, path);
}

export function planManagedInstall({ managedRoot, artifact, version, manifest }) {
  if (!version || /[\\/]/.test(version)) throw new Error('Invalid Throughline version');
  if (!/^[a-f\d]{64}$/.test(manifest.patch.sha256)) throw new Error('Invalid patch SHA-256');
  const releaseId = `${version}-${manifest.patch.sha256.slice(0, 12)}`;
  const releaseDirectory = resolve(managedRoot, 'releases', releaseId);
  if (!inside(resolve(managedRoot), releaseDirectory)) throw new Error('Managed release path escapes managed root');
  return {
    status: 'planned',
    managedRoot: resolve(managedRoot),
    releaseId,
    releaseDirectory,
    artifact: resolve(artifact),
    manifest,
    steps: ['install_package', 'verify_version', 'install_hooks', 'factory_diagnostics', 'write_receipt', 'select_release'],
  };
}

async function readCurrent(plan, fs) {
  const path = resolve(plan.managedRoot, 'current.json');
  if (!(await fs.exists(path))) return null;
  return JSON.parse(await fs.readText(path));
}

export async function applyManagedInstall({ plan, apply, home, fs, processAdapter }) {
  if (!apply) throw new Error('Managed installation requires explicit apply');
  if (!inside(plan.managedRoot, plan.releaseDirectory)) throw new Error('Release is outside managed root');
  const previous = await readCurrent(plan, fs);
  const before = await snapshotHome(home, fs);
  const env = { ...process.env, HOME: home };
  const binary = resolve(plan.releaseDirectory, 'node_modules/.bin/throughline');
  try {
    if (await fs.exists(plan.releaseDirectory)) throw new Error('Release directory already exists');
    await fs.mkdir(plan.releaseDirectory, { recursive: true });
    const installed = await processAdapter.run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', plan.releaseDirectory, plan.artifact], { env, timeoutMs: 120000 });
    if (installed.code !== 0) throw new Error(`npm install failed: ${installed.stderr}`);
    const version = await processAdapter.run(binary, ['--version'], { env, timeoutMs: 10000 });
    if (version.code !== 0) throw new Error(`version verification failed: ${version.stderr}`);
    const hooks = await processAdapter.run(binary, ['install'], { env, timeoutMs: 30000 });
    if (hooks.code !== 0) throw new Error(`hook installation failed: ${hooks.stderr}`);
    const after = await snapshotHome(home, fs);
    if (before.codexHooks !== null) {
      try {
        if (!deepSubset(JSON.parse(before.codexHooks), JSON.parse(after.codexHooks))) throw new Error('unrelated hook changed');
      } catch (error) {
        if (error.message === 'unrelated hook changed') throw error;
      }
    }
    const diagnostics = await processAdapter.run(binary, ['factory-diagnostics', '--json'], { env, timeoutMs: 20000 });
    if (diagnostics.code !== 0) throw new Error(`factory diagnostics failed: ${diagnostics.stderr}`);
    const parsed = JSON.parse(diagnostics.stdout);
    if (parsed.schema !== 'throughline.native_factory_diagnostics.v1') throw new Error('factory diagnostics schema incompatible');
    const receipt = {
      schema: 1,
      releaseId: plan.releaseId,
      installedAt: new Date().toISOString(),
      version: version.stdout.trim(),
      artifactSha256: sha256(await fs.readBytes(plan.artifact)),
      repository: plan.manifest.repository,
      baseCommit: plan.manifest.baseCommit,
      compatibilityCommit: plan.manifest.compatibilityCommit,
      patchSha256: plan.manifest.patch.sha256,
      configBefore: snapshotHashes(before),
      configAfter: snapshotHashes(after),
    };
    await atomicJson(resolve(plan.releaseDirectory, 'receipt.json'), receipt, fs);
    await atomicJson(resolve(plan.managedRoot, 'current.json'), { releaseId: plan.releaseId, previousReleaseId: previous?.releaseId ?? null }, fs);
    return { status: 'installed', releaseId: plan.releaseId, version: receipt.version, diagnostics: parsed.overall?.status ?? 'unknown' };
  } catch (error) {
    await restoreHome(home, before, fs);
    await fs.remove(plan.releaseDirectory, { recursive: true, force: true });
    throw error;
  }
}

export async function rollbackManagedInstall({ managedRoot, apply, home, fs, processAdapter }) {
  if (!apply) throw new Error('Managed rollback requires explicit apply');
  const root = resolve(managedRoot);
  const currentPath = resolve(root, 'current.json');
  const current = JSON.parse(await fs.readText(currentPath));
  if (!current.previousReleaseId) throw new Error('No previous managed release is available');
  const currentDirectory = resolve(root, 'releases', current.releaseId);
  const previousDirectory = resolve(root, 'releases', current.previousReleaseId);
  if (!inside(root, currentDirectory) || !inside(root, previousDirectory)) throw new Error('Rollback release path escapes managed root');
  const currentReceipt = JSON.parse(await fs.readText(resolve(currentDirectory, 'receipt.json')));
  const live = snapshotHashes(await snapshotHome(home, fs));
  for (const [key, expected] of Object.entries(currentReceipt.configAfter ?? {})) {
    if (live[key] !== expected) throw new Error(`Rollback refused because of concurrent change in ${key}`);
  }
  const before = await snapshotHome(home, fs);
  const env = { ...process.env, HOME: home };
  const currentBinary = resolve(currentDirectory, 'node_modules/.bin/throughline');
  const previousBinary = resolve(previousDirectory, 'node_modules/.bin/throughline');
  try {
    const removed = await processAdapter.run(currentBinary, ['uninstall'], { env, timeoutMs: 30000 });
    if (removed.code !== 0) throw new Error(`current uninstall failed: ${removed.stderr}`);
    const installed = await processAdapter.run(previousBinary, ['install'], { env, timeoutMs: 30000 });
    if (installed.code !== 0) throw new Error(`previous install failed: ${installed.stderr}`);
    const verified = await processAdapter.run(previousBinary, ['factory-diagnostics', '--json'], { env, timeoutMs: 20000 });
    if (verified.code !== 0) throw new Error(`previous verification failed: ${verified.stderr}`);
    await atomicJson(currentPath, { releaseId: current.previousReleaseId, previousReleaseId: current.releaseId }, fs);
    return { status: 'rolled_back', releaseId: current.previousReleaseId };
  } catch (error) {
    await restoreHome(home, before, fs);
    throw error;
  }
}
