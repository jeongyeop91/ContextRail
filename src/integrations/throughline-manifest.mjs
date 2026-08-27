import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { finish, issue } from '../core/result.mjs';

const KEYS = new Set(['schema', 'repository', 'baseCommit', 'compatibilityCommit', 'patch', 'license', 'tests', 'pack', 'removalCondition']);

function inside(root, path) {
  const value = relative(root, path);
  return value === '' || (!value.startsWith(`..${sep}`) && value !== '..' && !isAbsolute(value));
}

function validArgvList(value) {
  return Array.isArray(value) && value.length > 0 && value.every((argv) =>
    Array.isArray(argv) && argv.length > 0 && ['node', 'npm'].includes(argv[0]) && argv.every((part) => typeof part === 'string' && part.length > 0),
  );
}

export async function validateThroughlineManifest(root, manifest, fs) {
  const issues = [];
  for (const key of Object.keys(manifest ?? {})) if (!KEYS.has(key)) issues.push(issue('UNKNOWN_THROUGHLINE_MANIFEST_KEY', 'integrations/throughline/source.json', `Unknown key: ${key}`));
  if (manifest?.schema !== 1) issues.push(issue('INVALID_THROUGHLINE_SCHEMA', 'integrations/throughline/source.json', 'schema must be 1'));
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(manifest?.repository ?? '')) {
    issues.push(issue('INVALID_THROUGHLINE_REPOSITORY', 'integrations/throughline/source.json', 'Repository must be an HTTPS GitHub URL'));
  }
  for (const field of ['baseCommit', 'compatibilityCommit']) {
    if (!/^[a-f\d]{40}$/.test(manifest?.[field] ?? '')) issues.push(issue('INVALID_THROUGHLINE_COMMIT', 'integrations/throughline/source.json', `${field} must be an immutable 40-hex commit`));
  }
  if (!validArgvList(manifest?.tests)) issues.push(issue('INVALID_THROUGHLINE_TEST_ARGV', 'integrations/throughline/source.json', 'Tests must be node/npm argv arrays'));
  if (!validArgvList(manifest?.pack ? [manifest.pack] : null) || manifest?.pack?.[0] !== 'npm') issues.push(issue('INVALID_THROUGHLINE_PACK_ARGV', 'integrations/throughline/source.json', 'Pack must be an npm argv array'));
  if (typeof manifest?.removalCondition !== 'string' || !/upstream/i.test(manifest.removalCondition)) {
    issues.push(issue('MISSING_THROUGHLINE_REMOVAL_CONDITION', 'integrations/throughline/source.json', 'An upstream removal condition is required'));
  }

  const patchPath = resolve(root, manifest?.patch?.path ?? '');
  if (!inside(root, patchPath) || !(await fs.exists(patchPath))) {
    issues.push(issue('INVALID_THROUGHLINE_PATCH_PATH', manifest?.patch?.path ?? '', 'Patch path is missing or outside the repository'));
  } else {
    const actual = createHash('sha256').update(await fs.readText(patchPath)).digest('hex');
    if (!/^[a-f\d]{64}$/.test(manifest?.patch?.sha256 ?? '') || actual !== manifest.patch.sha256) {
      issues.push(issue('THROUGHLINE_PATCH_HASH_MISMATCH', manifest.patch.path, 'Patch SHA-256 does not match the manifest'));
    }
  }

  const licensePath = resolve(root, manifest?.license?.path ?? '');
  if (manifest?.license?.spdx !== 'MIT' || !inside(root, licensePath) || !(await fs.exists(licensePath))) {
    issues.push(issue('INVALID_THROUGHLINE_LICENSE', manifest?.license?.path ?? '', 'Pinned MIT license file is required'));
  }
  return finish(issues);
}

export async function loadThroughlineManifest(root, fs) {
  const path = resolve(root, 'integrations/throughline/source.json');
  const manifest = JSON.parse(await fs.readText(path));
  const validation = await validateThroughlineManifest(root, manifest, fs);
  return { ...validation, manifest };
}
