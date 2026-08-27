import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('README leads with the npm release-candidate two-command full setup', async () => {
  const readme = await readFile('README.md', 'utf8');
  const install = 'npm install --global contextrail@next';
  const setup = 'contextrail setup';
  assert.ok(readme.indexOf(install) > 0);
  assert.ok(readme.indexOf(setup) > readme.indexOf(install));
  assert.ok(readme.indexOf(install) < readme.indexOf('## What ContextRail provides'));
  assert.equal(readme.includes('ContextRail is not published to the npm registry'), false);
  assert.equal(readme.includes('$PWD'), false);
  assert.equal(readme.includes('@last'), false);
});

test('README documents every setup profile and explicit machine apply boundary', async () => {
  const readme = await readFile('README.md', 'utf8');
  for (const command of [
    'contextrail setup --core-only',
    'contextrail setup --no-context-hooks',
    'contextrail setup --use-existing-throughline',
    'contextrail setup --dry-run --json',
    'contextrail setup --apply --json',
  ]) assert.ok(readme.includes(command), command);
  assert.match(readme, /installed_live_verification_required/);
  assert.match(readme, /docs\/reference\/WINDOWS_PILOT\.md/);
});

test('Windows pilot keeps structural, capture, restore, and handoff evidence distinct', async () => {
  const pilot = await readFile('docs/reference/WINDOWS_PILOT.md', 'utf8');
  for (const phrase of ['PowerShell', 'capture', 'restore', 'handoff', 'installed_live_verification_required', 'Windows live validation: pending']) {
    assert.ok(pilot.includes(phrase), phrase);
  }
});

