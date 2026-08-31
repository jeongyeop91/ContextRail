import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('README leads with the npm release-candidate setup and human verification flow', async () => {
  const readme = await readFile('README.md', 'utf8');
  const install = 'npm install --global contextrail@next';
  const setup = 'contextrail setup';
  const doctor = 'contextrail doctor';
  const handoff = 'contextrail handoff --open-host desktop';
  assert.ok(readme.indexOf(install) > 0);
  assert.ok(readme.indexOf(setup) > readme.indexOf(install));
  assert.ok(readme.indexOf(doctor) > readme.indexOf(setup));
  assert.ok(readme.indexOf(handoff) > readme.indexOf(doctor));
  assert.ok(readme.indexOf(install) < readme.indexOf('## What ContextRail provides'));
  assert.equal(readme.includes('ContextRail is not published to the npm registry'), false);
  assert.equal(readme.includes('$PWD'), false);
  assert.equal(readme.includes('@last'), false);
});

test('README separates concise human output, machine JSON, and debug evidence', async () => {
  const readme = await readFile('README.md', 'utf8');
  for (const command of [
    'contextrail doctor',
    'contextrail doctor --debug',
    'contextrail doctor --json',
    'contextrail handoff --open-host desktop',
    'contextrail handoff --session codex:',
  ]) assert.ok(readme.includes(command), command);
  assert.match(readme, /Stop dispatch/i);
  assert.match(readme, /Throughline capture/i);
  assert.match(readme, /not the same evidence/i);
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
