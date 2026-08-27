import { resolve } from 'node:path';

import { nodeFilesystem } from '../adapters/filesystem.mjs';
import { finish, issue } from '../core/result.mjs';

const TOP_KEYS = new Set(['schema', 'releaseVersion', 'nodeVersion', 'platforms', 'throughline']);
const THROUGHLINE_KEYS = new Set([
  'packageVersion',
  'repository',
  'baseCommit',
  'compatibilityCommit',
  'patchSha256',
  'removalCondition',
  'artifact',
]);
const ARTIFACT_KEYS = new Set(['name', 'url', 'sha256']);
const PLATFORMS = new Set(['darwin', 'linux', 'win32']);
const SHA256 = /^[a-f\d]{64}$/;
const COMMIT = /^[a-f\d]{40}$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function unknownKeys(value, allowed, code, path, issues) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issues.push(issue(code, path, `Unknown key: ${key}`));
  }
}

function immutableArtifactUrl(value, releaseVersion) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'github.com'
      && url.pathname.includes(`/releases/download/v${releaseVersion}/`)
      && !url.pathname.includes('/latest/');
  } catch {
    return false;
  }
}

export function validateSetupManifest(value, { expectedVersion } = {}) {
  const issues = [];
  unknownKeys(value, TOP_KEYS, 'UNKNOWN_SETUP_MANIFEST_KEY', 'integrations/setup-manifest.json', issues);
  if (value?.schema !== 1) issues.push(issue('INVALID_SETUP_MANIFEST_SCHEMA', 'integrations/setup-manifest.json', 'schema must be 1'));
  if (!VERSION.test(value?.releaseVersion ?? '')) issues.push(issue('INVALID_SETUP_RELEASE_VERSION', 'integrations/setup-manifest.json', 'releaseVersion must be semantic'));
  if (expectedVersion && value?.releaseVersion !== expectedVersion) {
    issues.push(issue('SETUP_RELEASE_VERSION_MISMATCH', 'integrations/setup-manifest.json', `Expected ${expectedVersion}`));
  }
  if (value?.nodeVersion !== '>=22.13') issues.push(issue('INVALID_SETUP_NODE_VERSION', 'integrations/setup-manifest.json', 'nodeVersion must be >=22.13'));
  if (!Array.isArray(value?.platforms) || value.platforms.length !== 3 || value.platforms.some((entry) => !PLATFORMS.has(entry))) {
    issues.push(issue('INVALID_SETUP_PLATFORM', 'integrations/setup-manifest.json', 'platforms must contain darwin, linux, and win32'));
  }

  const throughline = value?.throughline;
  unknownKeys(throughline, THROUGHLINE_KEYS, 'UNKNOWN_SETUP_THROUGHLINE_KEY', 'integrations/setup-manifest.json', issues);
  if (!VERSION.test(throughline?.packageVersion ?? '')) issues.push(issue('INVALID_SETUP_THROUGHLINE_VERSION', 'integrations/setup-manifest.json', 'Throughline version must be semantic'));
  if (throughline?.repository !== 'https://github.com/kitepon/Throughline.git') issues.push(issue('INVALID_SETUP_THROUGHLINE_REPOSITORY', 'integrations/setup-manifest.json', 'Unexpected Throughline repository'));
  for (const key of ['baseCommit', 'compatibilityCommit']) {
    if (!COMMIT.test(throughline?.[key] ?? '')) issues.push(issue('INVALID_SETUP_THROUGHLINE_COMMIT', 'integrations/setup-manifest.json', `${key} must be immutable`));
  }
  if (!SHA256.test(throughline?.patchSha256 ?? '')) issues.push(issue('INVALID_SETUP_PATCH_SHA256', 'integrations/setup-manifest.json', 'patchSha256 must be SHA-256'));
  if (typeof throughline?.removalCondition !== 'string' || throughline.removalCondition.length < 20) {
    issues.push(issue('MISSING_SETUP_REMOVAL_CONDITION', 'integrations/setup-manifest.json', 'A compatibility-patch removal condition is required'));
  }

  const artifact = throughline?.artifact;
  unknownKeys(artifact, ARTIFACT_KEYS, 'UNKNOWN_SETUP_ARTIFACT_KEY', 'integrations/setup-manifest.json', issues);
  if (artifact?.name !== `throughline-${throughline?.packageVersion}.tgz`) {
    issues.push(issue('INVALID_THROUGHLINE_ARTIFACT_NAME', 'integrations/setup-manifest.json', 'Artifact name must match the Throughline version'));
  }
  if (!immutableArtifactUrl(artifact?.url, value?.releaseVersion)) {
    issues.push(issue('MUTABLE_THROUGHLINE_ARTIFACT_URL', 'integrations/setup-manifest.json', 'Artifact URL must select an immutable GitHub Release tag'));
  }
  if (!SHA256.test(artifact?.sha256 ?? '')) {
    issues.push(issue('INVALID_THROUGHLINE_ARTIFACT_SHA256', 'integrations/setup-manifest.json', 'Artifact sha256 must be 64 lowercase hex characters'));
  }
  return { ...finish(issues), ...(issues.length === 0 ? { manifest: structuredClone(value) } : {}) };
}

export async function loadSetupManifest({ root, fs = nodeFilesystem, expectedVersion } = {}) {
  const path = resolve(root, 'integrations/setup-manifest.json');
  try {
    return validateSetupManifest(JSON.parse(await fs.readText(path)), { expectedVersion });
  } catch (error) {
    return finish([issue('INVALID_SETUP_MANIFEST_JSON', 'integrations/setup-manifest.json', `Cannot load setup manifest: ${error.message}`)]);
  }
}

export function selectThroughlineArtifact(manifest) {
  return structuredClone(manifest.throughline.artifact);
}
