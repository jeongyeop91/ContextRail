const SECRET_KEY = /(?:token|password|secret|credential|authorization|cookie)/i;
const TOKEN_VALUE = /(?:npm_[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._~+\/-]+)/gi;

function stateLabel(value, ready = ['ready']) {
  return ready.includes(value) ? 'ready' : (value ?? 'unavailable');
}

function firstIssue(value) {
  const issue = value?.issues?.[0] ?? value?.report?.project?.issues?.[0];
  return issue?.message ?? issue?.code ?? null;
}

export function renderSetupHuman(value) {
  if (value?.status === 'planned') {
    const steps = (value.steps ?? []).map(({ id }) => id).join(', ') || 'verification';
    return [
      'ContextRail setup plan',
      `  Profile: ${value.profile ?? 'full'}`,
      `  Project: ${value.project?.kind ?? 'detected'}`,
      `  Steps: ${steps}`,
      'Next: run contextrail setup --apply, or run contextrail setup interactively',
    ].join('\n') + '\n';
  }

  if (['installed', 'installed_live_verification_required'].includes(value?.status)) {
    const report = value.report ?? value;
    const throughline = report.throughline ?? {};
    const throughlineState = ['hooks_ready', 'capture_verified'].includes(throughline.state) ? 'ready' : throughline.state;
    return [
      'ContextRail setup complete',
      `  Project: ${stateLabel(report.project?.state)}`,
      `  Throughline: ${throughlineState}${throughline.version ? ` (${throughline.version})` : ''}`,
      `  Codex Hooks: ${report.contextHooks?.state ?? 'not selected'}`,
      `  Automatic capture: ${value.status === 'installed' ? 'ready' : 'needs verification'}`,
      `Next: ${value.status === 'installed' ? 'contextrail handoff' : 'contextrail doctor'}`,
    ].join('\n') + '\n';
  }

  const cause = firstIssue(value) ?? value?.message ?? `setup status is ${value?.status ?? 'unknown'}`;
  const needsInput = value?.status === 'needs_input';
  return [
    `ContextRail setup ${needsInput ? 'needs input' : 'needs attention'}`,
    `  Cause: ${cause}`,
    `Next: ${needsInput ? 'review the project adoption mapping, then run contextrail setup again' : 'run contextrail doctor --debug'}`,
  ].join('\n') + '\n';
}

export function renderDoctorHuman(report) {
  const ready = report.status === 'ready';
  return [
    `ContextRail doctor ${ready ? 'ready' : 'needs attention'}`,
    `  Project: ${report.components.project}`,
    `  Throughline: ${report.components.throughline}`,
    `  Codex Hooks: ${report.components.codexHooks}`,
    `  Stop dispatch: ${report.components.stopDispatch}`,
    `  Automatic capture: ${report.components.automaticCapture}`,
    ...(!ready && report.cause ? [`Cause: ${report.cause}`] : []),
    `Next: ${report.nextAction}`,
  ].join('\n') + '\n';
}

function redact(value, key = '') {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return value.replace(TOKEN_VALUE, '[REDACTED]');
  if (Array.isArray(value)) return value.map((entry) => redact(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, redact(entry, name)]));
  }
  return value;
}

export function renderDebugEvidence(evidence) {
  return `Debug evidence\n${JSON.stringify(redact(evidence), null, 2)}\n`;
}

export function renderHandoffHuman(result) {
  if (result?.status !== 'started') {
    return [
      'ContextRail handoff needs attention',
      `  Cause: ${result?.reason ?? 'handoff failed'}`,
      'Next: contextrail doctor --debug',
    ].join('\n') + '\n';
  }
  const lines = [
    'ContextRail handoff started',
    `  Source memory: ${result.sourceSession ?? 'selected by Throughline'}`,
    `  New task: ${result.newTask?.id ?? 'created'}`,
    `  Memory: ${result.memory?.injected ? 'injected' : 'not injected'}`,
    `  Host: ${result.open?.status ?? 'not opened'}`,
  ];
  if (result.open?.status !== 'opened' && result.open?.resumeCommand) {
    lines.push(`Next: ${result.open.resumeCommand}`);
  }
  return `${lines.join('\n')}\n`;
}
