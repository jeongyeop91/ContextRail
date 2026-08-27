import { createHash } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import { finish, issue } from './result.mjs';

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function safeRelative(path) {
  return typeof path === 'string' && path.length > 0 && !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`) && !path.split(/[\\/]/).includes('..');
}

async function readOwnership(target, fs) {
  const path = resolve(target, '.context-rail/version.json');
  if (!(await fs.exists(path))) return {};
  try {
    return JSON.parse(await fs.readText(path)).ownedFiles ?? {};
  } catch {
    return {};
  }
}

export async function planScaffold({ mode, target, templateRoot, fs }) {
  const issues = [];
  if (!['init', 'adopt', 'upgrade'].includes(mode)) {
    return { ...finish([issue('INVALID_SCAFFOLD_MODE', '.', `Unknown scaffold mode: ${mode}`)]), mode, target, operations: [] };
  }
  const manifestPath = resolve(templateRoot, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await fs.readText(manifestPath));
  } catch (error) {
    return { ...finish([issue('INVALID_TEMPLATE_MANIFEST', 'manifest.json', error.message)]), mode, target, operations: [] };
  }
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (files.some((path) => !safeRelative(path))) {
    issues.push(issue('TEMPLATE_PATH_ESCAPE', 'manifest.json', 'Template file path escapes its root'));
    return { ...finish(issues), mode, target, operations: [] };
  }

  await fs.mkdir(target, { recursive: true });
  const targetEntries = await fs.list(target);
  if (mode === 'init' && targetEntries.some((entry) => entry !== '.git')) {
    issues.push(issue('TARGET_NOT_EMPTY', '.', 'init requires an empty target except for .git'));
  }
  const ownedFiles = mode === 'upgrade' ? await readOwnership(target, fs) : {};
  const operations = [];
  for (const path of files) {
    const source = resolve(templateRoot, path);
    const destination = resolve(target, path);
    if (relative(templateRoot, source).startsWith('..') || relative(target, destination).startsWith('..')) {
      issues.push(issue('TEMPLATE_PATH_ESCAPE', path, 'Resolved template path escapes its root'));
      continue;
    }
    const content = await fs.readText(source);
    const contentHash = hash(content);
    if (!(await fs.exists(destination))) {
      operations.push({ action: 'create', path, content, contentHash, reason: 'missing owned file' });
      continue;
    }
    const current = await fs.readText(destination);
    const currentHash = hash(current);
    if (currentHash === contentHash) {
      operations.push({ action: 'skip', path, content, contentHash, reason: 'already current' });
    } else if (mode === 'upgrade' && path === '.context-rail/version.json') {
      operations.push({ action: 'update', path, content, contentHash, reason: 'scaffold ownership manifest' });
    } else if (mode === 'upgrade' && ownedFiles[path] === currentHash) {
      operations.push({ action: 'update', path, content, contentHash, reason: 'matches prior owned hash' });
    } else if (mode === 'adopt') {
      operations.push({ action: 'skip', path, content, contentHash, reason: 'existing file is user-owned' });
    } else {
      operations.push({ action: 'conflict', path, content, contentHash, reason: 'existing content is not safely owned' });
      issues.push(issue('SCAFFOLD_CONFLICT', path, 'Existing content cannot be overwritten safely'));
    }
  }
  return { ...finish(issues, { creates: operations.filter((entry) => entry.action === 'create').length }), mode, target, operations };
}

export async function applyScaffold(plan, fs) {
  if (!plan.ok) throw new Error('Cannot apply an invalid scaffold plan');
  const applied = [];
  for (const [index, operation] of plan.operations.entries()) {
    if (!['create', 'update'].includes(operation.action)) continue;
    const destination = resolve(plan.target, operation.path);
    await fs.mkdir(dirname(destination), { recursive: true });
    const temporary = resolve(dirname(destination), `.${operation.path.split(/[\\/]/).at(-1)}.tmp-${process.pid}-${index}`);
    try {
      await fs.writeText(temporary, operation.content);
      await fs.rename(temporary, destination);
    } catch (error) {
      if (await fs.exists(temporary)) await fs.remove(temporary);
      throw error;
    }
    applied.push(operation.path);
  }
  if (plan.ownershipMode === 'precomputed') return { ok: true, applied };
  const versionPath = resolve(plan.target, '.context-rail/version.json');
  if (await fs.exists(versionPath)) {
    const version = JSON.parse(await fs.readText(versionPath));
    const prior = version.ownedFiles ?? {};
    const ownedFiles = { ...prior };
    for (const operation of plan.operations) {
      if (operation.path === '.context-rail/version.json') continue;
      if (['create', 'update'].includes(operation.action) || (operation.action === 'skip' && operation.reason === 'already current')) {
        ownedFiles[operation.path] = operation.contentHash;
      }
    }
    version.ownedFiles = Object.fromEntries(Object.entries(ownedFiles).sort(([left], [right]) => left.localeCompare(right)));
    await fs.writeText(versionPath, `${JSON.stringify(version, null, 2)}\n`);
  }
  return { ok: true, applied };
}
