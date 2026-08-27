import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('verification runs packed-artifact checks on Ubuntu, macOS, and Windows', async () => {
  const workflow = await readFile('.github/workflows/verify.yml', 'utf8');
  for (const runner of ['ubuntu-latest', 'macos-latest', 'windows-latest']) assert.ok(workflow.includes(runner));
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm pack --dry-run --json/);
  assert.match(workflow, /test\/release\.test\.mjs/);
  assert.equal(/cache:\s*false/.test(workflow), false);
});

test('release workflow builds both artifacts and gates stable publication on Windows live evidence', async () => {
  const workflow = await readFile('.github/workflows/release.yml', 'utf8');
  assert.match(workflow, /scripts\/build-throughline\.mjs/);
  assert.match(workflow, /scripts\/build-release\.mjs/);
  assert.match(workflow, /WINDOWS_LIVE_VALIDATED/);
  assert.match(workflow, /gh release create/);
  assert.equal(/cache:\s*false/.test(workflow), false);
});

test('npm publication uses OIDC, Node 24, explicit dist-tags, and no registry token', async () => {
  const workflow = await readFile('.github/workflows/publish.yml', 'utf8');
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /node-version:\s*['"]?24['"]?/);
  assert.match(workflow, /npm publish/);
  assert.match(workflow, /--tag "?next"?|--tag next/);
  assert.match(workflow, /--tag "?latest"?|--tag latest/);
  assert.equal(/NPM_TOKEN|NODE_AUTH_TOKEN/.test(workflow), false);
});

test('test fixtures never treat URL pathname as a native filesystem path', async () => {
  const files = [
    'test/adoption.test.mjs',
    'test/cli.test.mjs',
    'test/codex-hook-runtime.test.mjs',
    'test/continuity.test.mjs',
    'test/documents.test.mjs',
    'test/release.test.mjs',
    'test/routing.test.mjs',
    'test/scaffold.test.mjs',
    'test/state.test.mjs',
  ];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.equal(/new URL\([^\n]+\)\.pathname/.test(source), false, file);
  }
});
