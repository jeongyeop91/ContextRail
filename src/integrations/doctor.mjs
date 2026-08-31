export function buildDoctorReport({ setupReport, hookEvent = null, debugEvidence = null }) {
  const components = {
    project: setupReport?.project?.state ?? 'not_ready',
    throughline: ['hooks_ready', 'capture_verified'].includes(setupReport?.throughline?.state)
      ? 'ready'
      : (setupReport?.throughline?.state ?? 'unavailable'),
    codexHooks: setupReport?.contextHooks?.state ?? 'unavailable',
    stopDispatch: hookEvent?.event === 'Stop' && hookEvent.projectMatched === true ? 'observed' : 'not_observed',
    automaticCapture: setupReport?.throughline?.state === 'capture_verified'
      && setupReport?.live?.throughline === 'verified'
      ? 'ready'
      : 'unverified',
  };

  let cause = null;
  let nextAction = 'contextrail handoff';
  if (components.project !== 'ready') {
    cause = 'The project contract is not ready';
    nextAction = 'Run contextrail setup';
  } else if (components.throughline !== 'ready') {
    cause = 'Throughline is not ready';
    nextAction = 'Run contextrail setup';
  } else if (components.codexHooks !== 'registered') {
    cause = 'Codex Hooks are not registered';
    nextAction = 'Run contextrail setup';
  } else if (components.stopDispatch !== 'observed') {
    cause = 'No ContextRail Stop Hook dispatch has been observed';
    nextAction = 'Send one normal Codex prompt, then run contextrail doctor';
  } else if (components.automaticCapture !== 'ready') {
    cause = 'Throughline automatic capture has not been verified';
    nextAction = 'Run contextrail doctor --debug';
  }
  return {
    schema: 'contextrail.doctor.v1',
    status: cause ? 'needs_attention' : 'ready',
    components,
    cause,
    nextAction,
    hookEvent,
    ...(debugEvidence ? { debugEvidence } : {}),
  };
}
