import { nodeFilesystem } from '../adapters/filesystem.mjs';
import { resolveManagedThroughline, runThroughlineCommand } from './throughline-verify.mjs';

function failure(reason, message = null) {
  return {
    schema: 'contextrail.handoff.v1',
    status: 'needs_attention',
    reason,
    message,
    sourceSession: null,
    newTask: null,
    memory: { injected: false, delivery: null },
    open: { status: 'not_started', host: null, resumeCommand: null },
  };
}

function mapUpstream(value) {
  const thread = value?.newThread;
  if (value?.status !== 'started' || typeof thread?.threadId !== 'string' || thread.threadId.length === 0) {
    return failure(value?.reason ?? 'throughline_handoff_not_started');
  }
  const opened = value.open?.status === 'opened';
  return {
    schema: 'contextrail.handoff.v1',
    status: 'started',
    reason: value.reason ?? 'new_thread_handoff_started',
    sourceSession: value.sessionId ?? null,
    newTask: { id: thread.threadId, status: thread.status ?? 'started' },
    memory: { injected: thread.injectSent === true, delivery: thread.delivery ?? null },
    open: {
      status: value.open?.status ?? 'not_started',
      host: value.open?.host ?? value.resolvedOpenHost ?? null,
      reason: value.open?.reason ?? null,
      resumeCommand: opened ? null : (value.open?.resumeCommand ?? null),
    },
  };
}

export async function runManagedHandoff({
  managedRoot,
  nodePath,
  sessionId = null,
  openHost = 'auto',
  processAdapter,
  env = process.env,
  fs = nodeFilesystem,
}) {
  const args = [
    'codex-handoff-start',
    ...(sessionId ? ['--session', sessionId] : []),
    '--execute',
    '--open-host', openHost,
    '--json',
  ];
  let invocation = null;
  let upstream = null;
  try {
    invocation = await resolveManagedThroughline({ managedRoot, nodePath, fs });
    upstream = await runThroughlineCommand({
      ...invocation,
      processAdapter,
      env,
      args,
      timeoutMs: 180000,
    });
  } catch (error) {
    return {
      result: failure('throughline_unavailable', error.code ?? error.message),
      debugEvidence: { invocation, args, error: { code: error.code ?? null, message: error.message } },
    };
  }
  if (upstream.code !== 0) {
    return {
      result: failure('throughline_handoff_failed'),
      debugEvidence: { invocation, args, upstream },
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(upstream.stdout);
  } catch {
    return {
      result: failure('throughline_handoff_json_invalid'),
      debugEvidence: { invocation, args, upstream },
    };
  }
  return {
    result: mapUpstream(parsed),
    debugEvidence: { invocation, args, upstream, parsed },
  };
}
