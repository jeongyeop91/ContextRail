import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

import { nodeFilesystem, renameWithRetry } from '../adapters/filesystem.mjs';

export const CODEX_HOOK_EVENT_PATH = '.context-rail/runtime/codex-hook-events.json';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sessionIdentity(payload = {}) {
  if (typeof payload.session_id === 'string' && payload.session_id.length > 0) {
    return { value: payload.session_id, source: 'payload:session_id' };
  }
  if (typeof payload.sessionId === 'string' && payload.sessionId.length > 0) {
    return { value: payload.sessionId, source: 'payload:sessionId' };
  }
  return { value: 'unavailable', source: 'unavailable' };
}

function validMarker(value) {
  return value?.schema === 1
    && value.event === 'Stop'
    && typeof value.observedAt === 'string'
    && /^[a-f0-9]{64}$/.test(value.sessionIdHash ?? '')
    && ['payload:session_id', 'payload:sessionId', 'unavailable'].includes(value.sessionIdSource)
    && value.projectMatched === true
    && typeof value.status === 'string';
}

export async function recordCodexHookEvent({
  projectRoot,
  payload = {},
  result = {},
  fs = nodeFilesystem,
  now = () => new Date(),
}) {
  const identity = sessionIdentity(payload);
  const marker = {
    schema: 1,
    event: 'Stop',
    observedAt: now().toISOString(),
    sessionIdHash: sha256(identity.value),
    sessionIdSource: identity.source,
    projectMatched: true,
    status: typeof result.status === 'string' ? result.status : 'unknown',
  };
  const path = resolve(projectRoot, CODEX_HOOK_EVENT_PATH);
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  await fs.mkdir(dirname(path), { recursive: true });
  try {
    await fs.writeText(temporary, `${JSON.stringify(marker, null, 2)}\n`);
    await renameWithRetry(fs, temporary, path);
  } catch (error) {
    if (await fs.exists(temporary)) await fs.remove(temporary, { force: true });
    throw error;
  }
  return marker;
}

export async function readCodexHookEvent({ target, fs = nodeFilesystem }) {
  const path = resolve(target, CODEX_HOOK_EVENT_PATH);
  if (!await fs.exists(path)) return null;
  try {
    const value = JSON.parse(await fs.readText(path));
    return validMarker(value) ? value : null;
  } catch {
    return null;
  }
}
