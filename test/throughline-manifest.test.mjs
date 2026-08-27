import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadThroughlineManifest, validateThroughlineManifest } from '../src/integrations/throughline-manifest.mjs';
import { nodeFilesystem } from '../src/adapters/filesystem.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test('loads immutable Throughline provenance with matching patch and license', async () => {
  const result = await loadThroughlineManifest(ROOT, nodeFilesystem);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.match(result.manifest.baseCommit, /^[a-f\d]{40}$/);
  assert.match(result.manifest.compatibilityCommit, /^[a-f\d]{40}$/);
  assert.equal(result.manifest.repository, 'https://github.com/kitepon/Throughline.git');
  assert.equal(result.manifest.patch.sha256, '866ba2c07863e59defa44adf83f313db7596ca16b1775d4be0a00c6b2a58f3d8');
  assert.match(await readFile(resolve(ROOT, result.manifest.license.path), 'utf8'), /^MIT License/);
  assert.ok(result.manifest.tests.every((argv) => Array.isArray(argv)));
  assert.match(result.manifest.removalCondition, /upstream/i);
});

test('keeps hashed patch bytes LF-normalized across Git checkouts', async () => {
  const attributes = await readFile(resolve(ROOT, '.gitattributes'), 'utf8');
  assert.match(attributes, /^\* text=auto eol=lf$/m);
  assert.match(attributes, /^\*\.patch text eol=lf$/m);
});

test('rejects mutable, shell-string, hash, and unknown execution inputs', async () => {
  const base = (await loadThroughlineManifest(ROOT, nodeFilesystem)).manifest;
  const invalid = {
    ...base,
    repository: 'http://example.invalid/repo.git',
    baseCommit: 'main',
    tests: ['npm test'],
    command: 'rm -rf anything',
  };
  const result = await validateThroughlineManifest(ROOT, invalid, nodeFilesystem);
  const codes = result.issues.map((entry) => entry.code);
  assert.ok(codes.includes('INVALID_THROUGHLINE_REPOSITORY'));
  assert.ok(codes.includes('INVALID_THROUGHLINE_COMMIT'));
  assert.ok(codes.includes('INVALID_THROUGHLINE_TEST_ARGV'));
  assert.ok(codes.includes('UNKNOWN_THROUGHLINE_MANIFEST_KEY'));
});

test('rejects patch content whose digest differs from the manifest', async () => {
  const base = (await loadThroughlineManifest(ROOT, nodeFilesystem)).manifest;
  const result = await validateThroughlineManifest(ROOT, { ...base, patch: { ...base.patch, sha256: '0'.repeat(64) } }, nodeFilesystem);
  assert.ok(result.issues.some((entry) => entry.code === 'THROUGHLINE_PATCH_HASH_MISMATCH'));
});
