import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import {
  CODEX_HOOK_EVENT_PATH,
  readCodexHookEvent,
  recordCodexHookEvent,
} from '../src/integrations/codex-hook-diagnostics.mjs';

test('Stop records one privacy-safe latest dispatch marker', async () => {
  const target = await mkdtemp(join(tmpdir(), 'contextrail-hook-event-'));
  await mkdir(join(target, '.context-rail/runtime'), { recursive: true });

  const marker = await recordCodexHookEvent({
    projectRoot: target,
    payload: {
      session_id: 'thread-sensitive-id',
      cwd: target,
      last_assistant_message: '3973 private response',
      prompt: 'private prompt',
    },
    result: { status: 'passed', output: '{}\n' },
    fs: nodeFilesystem,
    now: () => new Date('2026-08-31T03:00:00.000Z'),
  });

  assert.deepEqual(marker, {
    schema: 1,
    event: 'Stop',
    observedAt: '2026-08-31T03:00:00.000Z',
    sessionIdHash: '8f58ce596d923350b32098cdb7bce8e499a76cfd8b4c6265f4c1132dba3edc7c',
    sessionIdSource: 'payload:session_id',
    projectMatched: true,
    status: 'passed',
  });
  assert.deepEqual(await readCodexHookEvent({ target, fs: nodeFilesystem }), marker);
  const raw = await readFile(join(target, CODEX_HOOK_EVENT_PATH), 'utf8');
  assert.doesNotMatch(raw, /thread-sensitive-id|3973|private prompt/);
});

test('a later Stop atomically replaces the bounded marker', async () => {
  const target = await mkdtemp(join(tmpdir(), 'contextrail-hook-event-replace-'));
  await mkdir(join(target, '.context-rail/runtime'), { recursive: true });
  for (const [session_id, status, observedAt] of [
    ['first-thread', 'passed', '2026-08-31T03:00:00.000Z'],
    ['second-thread', 'violations', '2026-08-31T03:01:00.000Z'],
  ]) {
    await recordCodexHookEvent({
      projectRoot: target,
      payload: { session_id, cwd: target },
      result: { status },
      fs: nodeFilesystem,
      now: () => new Date(observedAt),
    });
  }
  const marker = await readCodexHookEvent({ target, fs: nodeFilesystem });
  assert.equal(marker.observedAt, '2026-08-31T03:01:00.000Z');
  assert.equal(marker.status, 'violations');
  assert.equal((await nodeFilesystem.list(join(target, '.context-rail/runtime'))).length, 1);
});

test('missing or invalid markers are unavailable instead of throwing', async () => {
  const target = await mkdtemp(join(tmpdir(), 'contextrail-hook-event-missing-'));
  assert.equal(await readCodexHookEvent({ target, fs: nodeFilesystem }), null);
  await mkdir(join(target, '.context-rail/runtime'), { recursive: true });
  await nodeFilesystem.writeText(join(target, CODEX_HOOK_EVENT_PATH), '{invalid');
  assert.equal(await readCodexHookEvent({ target, fs: nodeFilesystem }), null);
});
