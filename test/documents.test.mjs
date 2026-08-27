import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { validateDocuments } from '../src/core/documents.mjs';
import { nodeFilesystem } from '../src/adapters/filesystem.mjs';

const config = {
  documentRouter: 'docs/README.md',
  authorityDirectory: 'docs/authority',
  limits: { routerLines: 50, authorityLines: 500 },
};

async function project({ router = '# Docs\n\n- [One](authority/ONE.md)\n', authority = '# One\n\n## Target\n', extra = {} } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-docs-'));
  await mkdir(join(root, 'docs/authority'), { recursive: true });
  await writeFile(join(root, 'docs/README.md'), router);
  await writeFile(join(root, 'docs/authority/ONE.md'), authority);
  for (const [path, content] of Object.entries(extra)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

async function codes(root) {
  const result = await validateDocuments(root, config, nodeFilesystem);
  return result.issues.map((issue) => issue.code);
}

test('reports a missing document router', async () => {
  const root = await project();
  const result = await validateDocuments(root, { ...config, documentRouter: 'docs/MISSING.md' }, nodeFilesystem);
  assert.ok(result.issues.some((issue) => issue.code === 'MISSING_ROUTER'));
});

test('reports an unindexed authority document', async () => {
  const root = await project({ extra: { 'docs/authority/TWO.md': '# Two\n' } });
  assert.ok((await codes(root)).includes('UNINDEXED_AUTHORITY'));
});

test('reports a 501-line authority document', async () => {
  const root = await project({ authority: Array.from({ length: 501 }, (_, index) => `line ${index}`).join('\n') });
  assert.ok((await codes(root)).includes('AUTHORITY_TOO_LARGE'));
});

test('reports missing files and heading anchors', async () => {
  const root = await project({
    authority: '# One\n\n[missing](../reference/MISSING.md)\n[anchor](#not-here)\n',
  });
  const found = await codes(root);
  assert.ok(found.includes('BROKEN_FILE_LINK'));
  assert.ok(found.includes('BROKEN_ANCHOR'));
});

test('rejects relative links that escape the repository', async () => {
  const root = await project({ authority: '# One\n\n[escape](../../../outside.md)\n' });
  assert.ok((await codes(root)).includes('PATH_ESCAPES_ROOT'));
});

test('accepts a valid routed authority set and relative heading link', async () => {
  const root = await project({
    router: '# Docs\n\n- [One](authority/ONE.md)\n- [Two](authority/TWO.md#two-heading)\n',
    extra: { 'docs/authority/TWO.md': '# Two\n\n## Two Heading\n' },
  });
  const result = await validateDocuments(root, config, nodeFilesystem);
  assert.deepEqual(result.issues, []);
  assert.equal(result.ok, true);
});

test('recursively validates existing authority roots while honoring file and directory excludes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-existing-docs-'));
  await cp(new URL('./fixtures/existing-repository/', import.meta.url), root, { recursive: true });
  const existing = JSON.parse(await nodeFilesystem.readText(join(root, 'adoption-config.json')));

  const result = await validateDocuments(root, existing, nodeFilesystem);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.equal(result.summary.authorityFiles, 3);
});

test('reports authority files reached through overlapping roots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-duplicate-docs-'));
  await cp(new URL('./fixtures/existing-repository/', import.meta.url), root, { recursive: true });
  const existing = JSON.parse(await nodeFilesystem.readText(join(root, 'adoption-config.json')));
  existing.authority.roots.push('docs/architecture');

  const result = await validateDocuments(root, existing, nodeFilesystem);
  assert.ok(result.issues.some((entry) => entry.code === 'DUPLICATE_AUTHORITY_PATH'));
});
