import { createHash } from 'node:crypto';

import { finish, issue } from '../core/result.mjs';

const TOP_KEYS = new Set(['schema', 'releaseVersion', 'sourceTag', 'setupManifestSha256', 'checksumsSha256', 'contextrail', 'throughline']);
const CONTEXT_RAIL_KEYS = new Set(['sha256', 'versionedAsset', 'stableAsset', 'npmPackage']);
const THROUGHLINE_KEYS = new Set(['name', 'url', 'sha256']);
const SHA256 = /^[a-f\d]{64}$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function unknownKeys(value, allowed, code, path, issues) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const key of Object.keys(value)) if (!allowed.has(key)) issues.push(issue(code, path, `Unknown key: ${key}`));
}

export function validateReleaseManifest(value) {
  const issues = [];
  unknownKeys(value, TOP_KEYS, 'UNKNOWN_RELEASE_MANIFEST_KEY', 'release-manifest.json', issues);
  unknownKeys(value?.contextrail, CONTEXT_RAIL_KEYS, 'UNKNOWN_CONTEXT_RAIL_ARTIFACT_KEY', 'release-manifest.json', issues);
  unknownKeys(value?.throughline, THROUGHLINE_KEYS, 'UNKNOWN_RELEASE_THROUGHLINE_KEY', 'release-manifest.json', issues);
  if (value?.schema !== 1) issues.push(issue('INVALID_RELEASE_MANIFEST_SCHEMA', 'release-manifest.json', 'schema must be 1'));
  if (!VERSION.test(value?.releaseVersion ?? '') || value?.sourceTag !== `v${value?.releaseVersion}`) {
    issues.push(issue('INVALID_RELEASE_IDENTITY', 'release-manifest.json', 'sourceTag must match the semantic releaseVersion'));
  }
  for (const [key, candidate] of [
    ['setupManifestSha256', value?.setupManifestSha256],
    ['checksumsSha256', value?.checksumsSha256],
    ['contextrail.sha256', value?.contextrail?.sha256],
    ['throughline.sha256', value?.throughline?.sha256],
  ]) {
    if (!SHA256.test(candidate ?? '')) issues.push(issue('INVALID_RELEASE_SHA256', 'release-manifest.json', `${key} must be SHA-256`));
  }
  if (value?.contextrail?.versionedAsset !== `contextrail-${value?.releaseVersion}.tgz`
    || value?.contextrail?.stableAsset !== 'contextrail.tgz'
    || value?.contextrail?.npmPackage !== `contextrail@${value?.releaseVersion}`) {
    issues.push(issue('INVALID_CONTEXT_RAIL_RELEASE_ASSETS', 'release-manifest.json', 'ContextRail asset names must match the release'));
  }
  return { ...finish(issues), ...(issues.length === 0 ? { manifest: structuredClone(value) } : {}) };
}

export function verifyReleaseEnvelope({ manifest, setupManifestBytes, checksumsBytes, contextrailSha256, throughlineSha256 }) {
  const validated = validateReleaseManifest(manifest);
  if (!validated.ok) return validated;
  const issues = [];
  if (digest(setupManifestBytes) !== manifest.setupManifestSha256) issues.push(issue('SETUP_MANIFEST_DIGEST_MISMATCH', 'integrations/setup-manifest.json', 'Embedded setup manifest digest differs from the release envelope'));
  if (digest(checksumsBytes) !== manifest.checksumsSha256) issues.push(issue('CHECKSUM_FILE_DIGEST_MISMATCH', 'SHA256SUMS.txt', 'Checksum file digest differs from the release envelope'));
  if (contextrailSha256 !== manifest.contextrail.sha256) issues.push(issue('CONTEXT_RAIL_ARTIFACT_DIGEST_MISMATCH', manifest.contextrail.versionedAsset, 'ContextRail artifact digest differs from the release envelope'));
  if (throughlineSha256 !== manifest.throughline.sha256) issues.push(issue('THROUGHLINE_ARTIFACT_DIGEST_MISMATCH', manifest.throughline.name, 'Throughline artifact digest differs from the release envelope'));
  return finish(issues);
}
