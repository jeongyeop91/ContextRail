import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';

import { codexAutomation } from './automation.mjs';
import { finish, issue } from './result.mjs';
import { VERSION } from '../version.mjs';

const PROFILE = 'existing-repository';
const CONFIG_PATH = '.context-rail/config.json';
const GITIGNORE_PATH = '.context-rail/.gitignore';
const VERSION_PATH = '.context-rail/version.json';
const GITIGNORE_CONTENT = 'runtime/\n';

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function normalizePath(value, path, issues) {
  if (typeof value !== 'string' || value.length === 0 || isAbsolute(value) || /^[a-z]:[\\/]/i.test(value) || value.startsWith('\\\\')) {
    issues.push(issue('INVALID_ADOPTION_PATH', path, 'Expected a non-empty repository-relative path'));
    return null;
  }
  const parts = value.replaceAll('\\', '/').split('/');
  if (parts.includes('..')) {
    issues.push(issue('ADOPTION_PATH_ESCAPE', path, 'Path must not escape the repository'));
    return null;
  }
  const normalized = parts.filter((part) => part !== '' && part !== '.').join('/');
  if (!normalized) {
    issues.push(issue('INVALID_ADOPTION_PATH', path, 'Expected a non-empty repository-relative path'));
    return null;
  }
  return normalized;
}

function normalizePathList(value, path, issues) {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(issue('INVALID_ADOPTION_CONFIG', path, 'Expected a non-empty array of repository-relative paths'));
    return [];
  }
  return value.map((entry, index) => normalizePath(entry, `${path}[${index}]`, issues)).filter(Boolean);
}

function positiveInteger(value, path, issues) {
  if (!Number.isInteger(value) || value < 1) {
    issues.push(issue('INVALID_ADOPTION_LIMIT', path, 'Expected a positive integer'));
    return null;
  }
  return value;
}

export function normalizeAdoptionConfig(value) {
  const issues = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...finish([issue('INVALID_ADOPTION_CONFIG', '.', 'Expected a JSON object')]), config: null };
  }
  if (value.schema !== 1) issues.push(issue('INVALID_ADOPTION_SCHEMA', 'schema', 'Only adoption schema 1 is supported'));
  if (value.profile !== PROFILE) issues.push(issue('INVALID_ADOPTION_PROFILE', 'profile', `Expected profile ${PROFILE}`));

  const documentRouter = normalizePath(value.documentRouter, 'documentRouter', issues);
  const instructionsFile = normalizePath(value.instructionsFile, 'instructionsFile', issues);
  const roots = normalizePathList(value.authority?.roots, 'authority.roots', issues);
  const exclude = Array.isArray(value.authority?.exclude)
    ? value.authority.exclude.map((entry, index) => normalizePath(entry, `authority.exclude[${index}]`, issues)).filter(Boolean)
    : [];
  if (value.authority?.exclude !== undefined && !Array.isArray(value.authority.exclude)) {
    issues.push(issue('INVALID_ADOPTION_CONFIG', 'authority.exclude', 'Expected an array of repository-relative paths'));
  }

  if (value.state?.mode !== 'references') {
    issues.push(issue('INVALID_ADOPTION_STATE_MODE', 'state.mode', 'Existing repositories must use references state mode'));
  }
  const current = normalizePath(value.state?.current, 'state.current', issues);
  const planDirectory = normalizePath(value.state?.planDirectory, 'state.planDirectory', issues);
  const backlog = normalizePath(value.state?.backlog, 'state.backlog', issues);
  const routerLines = positiveInteger(value.limits?.routerLines, 'limits.routerLines', issues);
  const authorityLines = positiveInteger(value.limits?.authorityLines, 'limits.authorityLines', issues);

  let validationHints = [];
  if (value.validationHints !== undefined) {
    if (!Array.isArray(value.validationHints) || value.validationHints.some((hint) =>
      !Array.isArray(hint) || hint.length === 0 || hint.some((argument) => typeof argument !== 'string' || argument.length === 0)
    )) {
      issues.push(issue('INVALID_VALIDATION_HINTS', 'validationHints', 'Expected an array of non-empty argv arrays'));
    } else {
      validationHints = value.validationHints.map((hint) => [...hint]);
    }
  }

  const config = {
    schema: 1,
    profile: PROFILE,
    documentRouter,
    authority: { roots, exclude },
    state: { mode: 'references', current, planDirectory, backlog },
    limits: { routerLines, authorityLines },
    instructionsFile,
    validationHints,
    ...(value.automation === undefined ? {} : { automation: { codex: codexAutomation(value) } }),
  };
  return { ...finish(issues), config: issues.length === 0 ? config : null };
}

async function operationForAdoption(target, path, content, fs) {
  const destination = resolve(target, path);
  const contentHash = hash(content);
  if (!(await fs.exists(destination))) return { action: 'create', path, content, contentHash, reason: 'missing ContextRail metadata' };
  const currentHash = hash(await fs.readText(destination));
  if (currentHash === contentHash) return { action: 'skip', path, content, contentHash, reason: 'already current' };
  return { action: 'conflict', path, content, contentHash, currentHash, reason: 'existing metadata is not safely owned' };
}

function versionContent(ownedFiles) {
  return `${JSON.stringify({
    schema: 1,
    templateVersion: VERSION,
    profile: PROFILE,
    ownedFiles: Object.fromEntries(Object.entries(ownedFiles).sort(([left], [right]) => left.localeCompare(right))),
  }, null, 2)}\n`;
}

export async function planExistingRepositoryAdoption({ target, config: input, fs }) {
  const normalized = normalizeAdoptionConfig(input);
  if (!normalized.ok) return { ...normalized, mode: 'adopt', target, operations: [], ownershipMode: 'precomputed' };

  const configContent = `${JSON.stringify(normalized.config, null, 2)}\n`;
  const base = [
    await operationForAdoption(target, GITIGNORE_PATH, GITIGNORE_CONTENT, fs),
    await operationForAdoption(target, CONFIG_PATH, configContent, fs),
  ];
  const ownedFiles = Object.fromEntries(base.filter((entry) => entry.action === 'create').map((entry) => [entry.path, entry.contentHash]));
  const operations = [...base, await operationForAdoption(target, VERSION_PATH, versionContent(ownedFiles), fs)];
  const issues = operations
    .filter((entry) => entry.action === 'conflict')
    .map((entry) => issue('SCAFFOLD_CONFLICT', entry.path, 'Existing ContextRail metadata cannot be overwritten safely'));
  return {
    ...finish(issues, { creates: operations.filter((entry) => entry.action === 'create').length }),
    mode: 'adopt',
    profile: PROFILE,
    target,
    operations,
    ownershipMode: 'precomputed',
  };
}

async function loadJson(target, path, fs, code, issues) {
  const destination = resolve(target, path);
  try {
    return JSON.parse(await fs.readText(destination));
  } catch (error) {
    issues.push(issue(code, path, `Cannot load JSON: ${error.message}`));
    return null;
  }
}

async function operationForUpgrade(target, path, content, ownedFiles, fs) {
  const destination = resolve(target, path);
  const contentHash = hash(content);
  if (!(await fs.exists(destination))) return { action: 'create', path, content, contentHash, reason: 'missing owned metadata' };
  const currentHash = hash(await fs.readText(destination));
  if (ownedFiles[path] !== currentHash) {
    return { action: 'conflict', path, content, contentHash, currentHash, reason: 'current content does not match prior owned hash' };
  }
  if (currentHash === contentHash) return { action: 'skip', path, content, contentHash, reason: 'already current' };
  return { action: 'update', path, content, contentHash, currentHash, reason: 'matches prior owned hash' };
}

export async function planExistingRepositoryUpgrade({ target, fs }) {
  const issues = [];
  const storedConfig = await loadJson(target, CONFIG_PATH, fs, 'INVALID_CONFIG', issues);
  const storedVersion = await loadJson(target, VERSION_PATH, fs, 'INVALID_VERSION', issues);
  if (!storedConfig || !storedVersion) {
    return { ...finish(issues), mode: 'upgrade', profile: PROFILE, target, operations: [], ownershipMode: 'precomputed' };
  }
  const normalized = normalizeAdoptionConfig(storedConfig);
  issues.push(...normalized.issues);
  if (storedVersion.profile !== PROFILE) {
    issues.push(issue('INVALID_ADOPTION_PROFILE', VERSION_PATH, `Expected profile ${PROFILE}`));
  }
  if (!normalized.ok || issues.length > 0) {
    return { ...finish(issues), mode: 'upgrade', profile: PROFILE, target, operations: [], ownershipMode: 'precomputed' };
  }

  const configContent = `${JSON.stringify(normalized.config, null, 2)}\n`;
  const priorOwned = storedVersion.ownedFiles && typeof storedVersion.ownedFiles === 'object' ? storedVersion.ownedFiles : {};
  const base = [
    await operationForUpgrade(target, GITIGNORE_PATH, GITIGNORE_CONTENT, priorOwned, fs),
    await operationForUpgrade(target, CONFIG_PATH, configContent, priorOwned, fs),
  ];
  const nextOwned = Object.fromEntries(base
    .filter((entry) => entry.action !== 'conflict')
    .map((entry) => [entry.path, entry.contentHash]));
  const desiredVersion = versionContent(nextOwned);
  const currentVersion = await fs.readText(resolve(target, VERSION_PATH));
  const versionOperation = currentVersion === desiredVersion
    ? { action: 'skip', path: VERSION_PATH, content: desiredVersion, contentHash: hash(desiredVersion), reason: 'already current' }
    : { action: 'update', path: VERSION_PATH, content: desiredVersion, contentHash: hash(desiredVersion), reason: 'scaffold ownership manifest' };
  const operations = [...base, versionOperation];
  issues.push(...operations
    .filter((entry) => entry.action === 'conflict')
    .map((entry) => issue('SCAFFOLD_CONFLICT', entry.path, 'Owned ContextRail metadata was modified')));
  return {
    ...finish(issues, { creates: operations.filter((entry) => entry.action === 'create').length }),
    mode: 'upgrade',
    profile: PROFILE,
    target,
    operations,
    ownershipMode: 'precomputed',
  };
}

export const EXISTING_REPOSITORY_PROFILE = PROFILE;
