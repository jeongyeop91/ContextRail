import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('README leads with the stable npm setup and human verification flow', async () => {
  const readme = await readFile('README.md', 'utf8');
  const install = 'npm install --global contextrail';
  const setup = 'contextrail setup';
  const doctor = 'contextrail doctor';
  const handoff = 'contextrail handoff';
  assert.ok(readme.indexOf(install) > 0);
  assert.ok(readme.indexOf(setup) > readme.indexOf(install));
  assert.ok(readme.indexOf(doctor) > readme.indexOf(setup));
  assert.ok(readme.indexOf(handoff) > readme.indexOf(doctor));
  assert.ok(readme.indexOf(install) < readme.indexOf('## What ContextRail provides'));
  assert.equal(readme.includes('ContextRail is not published to the npm registry'), false);
  assert.equal(readme.includes('$PWD'), false);
  assert.equal(readme.includes('@last'), false);
  assert.equal(readme.includes('contextrail@next'), false);
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

test('README separates complete new-project and existing-project setup paths', async () => {
  const readme = await readFile('README.md', 'utf8');
  const newHeading = '## Apply ContextRail to a new project';
  const existingHeading = '## Apply ContextRail to an existing project';
  const newStart = readme.indexOf(newHeading);
  const existingStart = readme.indexOf(existingHeading);
  assert.ok(newStart > 0, newHeading);
  assert.ok(existingStart > newStart, existingHeading);

  const newGuide = readme.slice(newStart, existingStart);
  for (const command of [
    'npm install --global contextrail',
    'contextrail setup',
    'contextrail doctor',
    'contextrail handoff',
  ]) assert.ok(newGuide.includes(command), command);

  const existingGuide = readme.slice(existingStart, readme.indexOf('## Native state and references mode'));
  for (const command of [
    'contextrail setup --project existing --adoption-config',
    '--dry-run --json',
    '--apply --json',
    'contextrail doctor',
    'contextrail handoff',
  ]) assert.ok(existingGuide.includes(command), command);
  assert.match(existingGuide, /temporary/i);
  assert.match(existingGuide, /does not modify/i);
});

test('Windows pilot records passed structural, capture, restore, and handoff evidence', async () => {
  const pilot = await readFile('docs/reference/WINDOWS_PILOT.md', 'utf8');
  for (const phrase of ['PowerShell', 'capture', 'restore', 'handoff', 'installed_live_verification_required', 'Windows live validation: passed']) {
    assert.ok(pilot.includes(phrase), phrase);
  }
});
