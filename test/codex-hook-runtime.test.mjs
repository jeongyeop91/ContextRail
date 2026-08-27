import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { handleStop, handleUserPromptSubmit } from '../src/integrations/codex-hook-runtime.mjs';

const TEMPLATE = new URL('../templates/project/', import.meta.url).pathname;

async function project({ enabled = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-hook-runtime-'));
  await cp(TEMPLATE, root, { recursive: true });
  const configPath = join(root, '.context-rail/config.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.automation = { codex: { enabled, promptRouting: true, stopCheck: true } };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const cwd = join(root, 'src/service');
  await mkdir(cwd, { recursive: true });
  return { root, cwd };
}

function promptPayload(cwd, prompt) {
  return {
    session_id: 'synthetic-session',
    transcript_path: null,
    cwd,
    hook_event_name: 'UserPromptSubmit',
    model: 'synthetic-model',
    turn_id: 'synthetic-turn',
    permission_mode: 'default',
    prompt,
  };
}

function stopPayload(cwd) {
  return {
    session_id: 'synthetic-session',
    transcript_path: null,
    cwd,
    hook_event_name: 'Stop',
    model: 'synthetic-model',
    turn_id: 'synthetic-turn',
    permission_mode: 'default',
    stop_hook_active: false,
    last_assistant_message: 'Synthetic completion.',
  };
}

test('UserPromptSubmit is a quiet no-op outside ContextRail and when automation is disabled', async () => {
  const outside = await mkdtemp(join(tmpdir(), 'contextrail-hook-outside-'));
  assert.equal((await handleUserPromptSubmit(promptPayload(outside, 'edit a file'), { fs: nodeFilesystem })).output, '');

  const disabled = await project({ enabled: false });
  assert.equal((await handleUserPromptSubmit(promptPayload(disabled.cwd, 'edit a file'), { fs: nodeFilesystem })).output, '');
});

test('UserPromptSubmit routes bounded paths without echoing the raw prompt', async () => {
  const scope = await project();
  const secretPrompt = 'edit the service using SECRET_RAW_PROMPT_VALUE';
  const result = await handleUserPromptSubmit(promptPayload(scope.cwd, secretPrompt), { fs: nodeFilesystem });
  const output = JSON.parse(result.output);
  const context = output.hookSpecificOutput.additionalContext;

  assert.equal(result.mode, 'route');
  assert.equal(output.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(context, /AGENTS\.md/);
  assert.match(context, /docs\/README\.md/);
  assert.match(context, /state\/CURRENT\.md/);
  assert.match(context, /Read only the listed/);
  assert.doesNotMatch(context, /SECRET_RAW_PROMPT_VALUE/);
  assert.ok(Buffer.byteLength(result.output) <= 8192);
});

test('UserPromptSubmit remains bounded when a repository declares excessive validation hints', async () => {
  const scope = await project();
  const configPath = join(scope.root, '.context-rail/config.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.state = { mode: 'references', current: 'state/CURRENT.md', planDirectory: 'state', backlog: 'state/BACKLOG.json' };
  config.validationHints = Array.from({ length: 50 }, (_, index) => [
    'node',
    `validation-${index}-${'x'.repeat(300)}`,
    `argument-${'y'.repeat(300)}`,
  ]);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  const result = await handleUserPromptSubmit(promptPayload(scope.cwd, 'edit a file'), { fs: nodeFilesystem });
  assert.ok(Buffer.byteLength(result.output) <= 8192, `hook output was ${Buffer.byteLength(result.output)} bytes`);
});

test('UserPromptSubmit selects continuation for English and Korean resume prompts', async () => {
  const scope = await project();
  for (const prompt of ['continue', '계속해']) {
    const result = await handleUserPromptSubmit(promptPayload(scope.cwd, prompt), { fs: nodeFilesystem });
    assert.equal(result.mode, 'continue');
    const context = JSON.parse(result.output).hookSpecificOutput.additionalContext;
    assert.match(context, /continuation/);
    assert.match(context, /state\/BACKLOG\.json/);
  }
});

test('Stop returns non-blocking JSON for passing, failing, and disabled projects', async () => {
  const scope = await project();
  assert.equal((await handleStop(stopPayload(scope.cwd), { fs: nodeFilesystem })).output, '{}\n');

  await rm(join(scope.root, 'docs/README.md'));
  const failed = await handleStop(stopPayload(scope.cwd), { fs: nodeFilesystem });
  const warning = JSON.parse(failed.output);
  assert.equal(failed.status, 'violations');
  assert.match(warning.systemMessage, /MISSING_ROUTER/);
  assert.match(warning.systemMessage, /docs\/README\.md/);
  assert.equal('decision' in warning, false);
  assert.ok(Buffer.byteLength(failed.output) <= 4096);

  const disabled = await project({ enabled: false });
  assert.equal((await handleStop(stopPayload(disabled.cwd), { fs: nodeFilesystem })).output, '{}\n');
});
