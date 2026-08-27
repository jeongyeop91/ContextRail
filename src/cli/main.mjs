import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nodeFilesystem } from '../adapters/filesystem.mjs';
import { nodeProcess } from '../adapters/process.mjs';
import { EXISTING_REPOSITORY_PROFILE, normalizeAdoptionConfig, planExistingRepositoryAdoption, planExistingRepositoryUpgrade } from '../core/adoption.mjs';
import { applyProjectAutomation, codexAutomation, planProjectAutomation } from '../core/automation.mjs';
import { buildContinuation } from '../core/continuity.mjs';
import { validateDocuments } from '../core/documents.mjs';
import { appendMeasurement, readMeasurements, summarizeMeasurements } from '../core/measurement.mjs';
import { finish, issue } from '../core/result.mjs';
import { buildRoute } from '../core/routing.mjs';
import { applyScaffold, planScaffold } from '../core/scaffold.mjs';
import { validateState } from '../core/state.mjs';
import { findContextRailRoot, handleStop, handleUserPromptSubmit } from '../integrations/codex-hook-runtime.mjs';
import {
  applyCodexHooksInstall,
  applyCodexHooksUninstall,
  planCodexHooksInstall,
  planCodexHooksUninstall,
  verifyCodexHooks,
} from '../integrations/codex-hooks.mjs';
import { loadThroughlineManifest } from '../integrations/throughline-manifest.mjs';
import { applyManagedInstall, planManagedInstall, rollbackManagedInstall } from '../integrations/throughline-install.mjs';
import { planPreparation } from '../integrations/throughline-prepare.mjs';
import { verifyThroughline } from '../integrations/throughline-verify.mjs';
import { VERSION } from '../version.mjs';

const PROJECT_TEMPLATE = resolve(dirname(fileURLToPath(import.meta.url)), '../../templates/project');
const USAGE = `Usage:
  contextrail init|adopt|upgrade [--target PATH] [--dry-run|--apply] [--json]
  contextrail adopt --profile existing-repository --adoption-config FILE [--target PATH] [--dry-run|--apply] [--json]
  contextrail check [--target PATH] [--json]
  contextrail route PATH [--target PATH] [--json]
  contextrail continue [--target PATH] [--json]
  contextrail measure record --task ID --source SOURCE [metric options] [--target PATH] [--json]
  contextrail measure report [--target PATH] [--json]
  contextrail throughline prepare --dry-run [--target PATH] [--json]
  contextrail throughline install --dry-run [--managed-root PATH] [--json]
  contextrail throughline install --apply --artifact FILE [--managed-root PATH] [--json]
  contextrail throughline verify [--binary FILE] [--doctor] [--json]
  contextrail throughline rollback --apply [--managed-root PATH] [--json]
  contextrail hooks install --host codex (--dry-run|--apply) [--json]
  contextrail hooks verify --host codex [--target PATH] [--json]
  contextrail hooks uninstall --host codex (--dry-run|--apply) [--json]
  contextrail automation enable|disable --host codex [--target PATH] (--dry-run|--apply) [--json]
`;

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

function unknownOptions(args, positionalCount, supported) {
  const options = new Set(supported);
  const flags = new Set(['--json', '--dry-run', '--apply', '--doctor']);
  let positionals = 0;
  for (let index = 1; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith('--')) {
      if (!options.has(value)) return true;
      if (!flags.has(value)) index += 1;
    } else {
      positionals += 1;
    }
  }
  return positionals !== positionalCount;
}

const METRIC_OPTIONS = new Map([
  ['--input-tokens', 'inputTokens'],
  ['--output-tokens', 'outputTokens'],
  ['--context-window-tokens', 'contextWindowTokens'],
  ['--context-utilization-ratio', 'contextUtilizationRatio'],
  ['--turns', 'turns'],
  ['--sessions', 'sessions'],
  ['--handoffs', 'handoffs'],
  ['--files-read', 'filesRead'],
  ['--document-bytes', 'documentBytes'],
  ['--instruction-bytes', 'instructionBytes'],
  ['--routed-bytes', 'routedBytes'],
  ['--duration-ms', 'durationMs'],
]);

async function validateProject(root) {
  let config;
  try {
    config = JSON.parse(await nodeFilesystem.readText(resolve(root, '.context-rail/config.json')));
  } catch (error) {
    return finish([issue('INVALID_CONFIG', '.context-rail/config.json', `Cannot load configuration: ${error.message}`)]);
  }
  if (config.profile === EXISTING_REPOSITORY_PROFILE) {
    const normalized = normalizeAdoptionConfig(config);
    if (!normalized.ok) return normalized;
    config = normalized.config;
  }
  const documents = await validateDocuments(root, config, nodeFilesystem);
  const state = await validateState(root, config, nodeFilesystem);
  return finish([...documents.issues, ...state.issues], { documents: documents.summary, state: state.summary });
}

function writeResult(result, json, io) {
  if (json) io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else if (result.ok) io.stdout.write(`ContextRail check passed (${result.summary.documents?.authorityFiles ?? 0} authority files).\n`);
  else {
    io.stderr.write(`ContextRail check found ${result.issues.length} issue(s).\n`);
    for (const entry of result.issues) io.stderr.write(`${entry.code} ${entry.path}: ${entry.message}\n`);
  }
}

function writeStructured(result, json, io) {
  if (json) io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function publicScaffoldPlan(plan, applied = null) {
  return {
    ok: plan.ok,
    mode: plan.mode,
    target: plan.target,
    issues: plan.issues,
    operations: plan.operations.map(({ action, path, contentHash, reason }) => ({ action, path, contentHash, reason })),
    applied,
  };
}

function explicitWriteBoundary(args) {
  return args.includes('--dry-run') !== args.includes('--apply');
}

function publicHooksPlan(plan, applied = null) {
  return {
    ok: plan.ok,
    status: applied?.status ?? plan.status,
    issues: plan.issues,
    summary: plan.summary,
    files: plan.files,
    entries: plan.entries?.map((entry) => ({
      event: entry.event,
      command: entry.group.hooks[0].command,
      timeout: entry.group.hooks[0].timeout,
    })) ?? [],
    applyRequired: plan.status === 'planned' && applied === null,
  };
}

function publicAutomationPlan(plan, applied = null) {
  return {
    ok: plan.ok,
    mode: plan.mode,
    target: plan.target,
    issues: plan.issues,
    summary: plan.summary,
    operations: plan.operations.map(({ action, path, contentHash }) => ({ action, path, contentHash })),
    applied,
  };
}

async function readHookPayload(io, dependencies) {
  if (dependencies.hookInput !== undefined) {
    return typeof dependencies.hookInput === 'string' ? JSON.parse(dependencies.hookInput) : dependencies.hookInput;
  }
  let value = '';
  for await (const chunk of (io.stdin ?? process.stdin)) value += chunk;
  return JSON.parse(value);
}

function failOpenHookOutput(io) {
  io.stdout.write(`${JSON.stringify({
    systemMessage: 'ContextRail Hook input unavailable (CONTEXT_RAIL_HOOK_ERROR); continuing without blocking Codex.',
  })}\n`);
}

async function syntheticCodexHookSmoke() {
  const target = await mkdtemp(resolve(tmpdir(), 'contextrail-hook-smoke-'));
  try {
    const scaffold = await planScaffold({ mode: 'init', target, templateRoot: PROJECT_TEMPLATE, fs: nodeFilesystem });
    if (!scaffold.ok) throw new Error('Synthetic ContextRail scaffold planning failed');
    await applyScaffold(scaffold, nodeFilesystem);
    const automation = await planProjectAutomation({ target, enabled: true, fs: nodeFilesystem });
    if (!automation.ok) throw new Error('Synthetic ContextRail automation planning failed');
    await applyProjectAutomation(automation, nodeFilesystem);

    const routed = await handleUserPromptSubmit({ cwd: target, prompt: 'inspect the current project' });
    const continued = await handleUserPromptSubmit({ cwd: target, prompt: 'continue' });
    const passing = await handleStop({ cwd: target, stop_hook_active: false });
    await nodeFilesystem.writeText(
      resolve(target, 'docs/README.md'),
      `${Array.from({ length: 51 }, (_, index) => `- overflow ${index + 1}`).join('\n')}\n`,
    );
    const failing = await handleStop({ cwd: target, stop_hook_active: false });
    return {
      route: routed.mode === 'route' && routed.output.includes('additionalContext') ? 'passed' : 'failed',
      continue: continued.mode === 'continue' && continued.output.includes('additionalContext') ? 'passed' : 'failed',
      check: passing.status === 'passed' && failing.status === 'violations' ? 'passed' : 'failed',
    };
  } catch {
    return { route: 'failed', continue: 'failed', check: 'failed' };
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

async function selectedProjectAutomation(root) {
  try {
    const projectRoot = await findContextRailRoot(root);
    if (!projectRoot) return { enabled: false, projectRoot: null };
    const config = JSON.parse(await nodeFilesystem.readText(resolve(projectRoot, '.context-rail/config.json')));
    return { ...codexAutomation(config), projectRoot };
  } catch {
    return { enabled: false, projectRoot: null, state: 'unavailable' };
  }
}

export async function run(args = process.argv.slice(2), io = process, dependencies = {}) {
  const command = args[0];
  if (command === '--version' || command === '-v') {
    io.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (command === '--help' || command === '-h' || command === 'help') {
    io.stdout.write(USAGE);
    return 0;
  }
  const targetValue = optionValue(args, '--target');
  if (args.includes('--target') && !targetValue) {
    io.stderr.write('--target requires a path\n');
    return 2;
  }
  const root = resolve(targetValue ?? process.cwd());
  const json = args.includes('--json');

  if (command === 'hook' && ['user-prompt-submit', 'stop'].includes(args[1])) {
    if (unknownOptions(args, 1, [])) {
      failOpenHookOutput(io);
      return 0;
    }
    try {
      const payload = await readHookPayload(io, dependencies);
      const result = args[1] === 'user-prompt-submit'
        ? await handleUserPromptSubmit(payload)
        : await handleStop(payload);
      io.stdout.write(result.output);
    } catch {
      failOpenHookOutput(io);
    }
    return 0;
  }

  if (command === 'hooks' && ['install', 'uninstall'].includes(args[1])) {
    if (unknownOptions(args, 1, ['--host', '--json', '--dry-run', '--apply'])
      || optionValue(args, '--host') !== 'codex'
      || !explicitWriteBoundary(args)) {
      io.stderr.write(USAGE);
      return 2;
    }
    const home = resolve(dependencies.home ?? homedir());
    const nodePath = resolve(dependencies.nodePath ?? process.execPath);
    const cliPath = resolve(dependencies.cliPath ?? process.argv[1]);
    const installing = args[1] === 'install';
    const plan = installing
      ? await planCodexHooksInstall({ home, nodePath, cliPath, fs: nodeFilesystem })
      : await planCodexHooksUninstall({ home, fs: nodeFilesystem });
    if (!plan.ok || args.includes('--dry-run')) {
      writeStructured(publicHooksPlan(plan), json, io);
      return plan.ok ? 0 : 1;
    }
    try {
      const applied = installing
        ? await applyCodexHooksInstall(plan, { fs: nodeFilesystem })
        : await applyCodexHooksUninstall(plan, { fs: nodeFilesystem });
      writeStructured(publicHooksPlan(plan, applied), json, io);
      return 0;
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return 3;
    }
  }

  if (command === 'hooks' && args[1] === 'verify') {
    if (unknownOptions(args, 1, ['--host', '--target', '--json']) || optionValue(args, '--host') !== 'codex') {
      io.stderr.write(USAGE);
      return 2;
    }
    const report = await verifyCodexHooks({
      home: resolve(dependencies.home ?? homedir()),
      nodePath: resolve(dependencies.nodePath ?? process.execPath),
      cliPath: resolve(dependencies.cliPath ?? process.argv[1]),
      projectAutomation: await selectedProjectAutomation(root),
      smoke: await syntheticCodexHookSmoke(),
      fs: nodeFilesystem,
    });
    writeStructured(report, json, io);
    return report.state === 'registered' && Object.values(report.smoke).every((state) => state === 'passed') ? 0 : 3;
  }

  if (command === 'automation' && ['enable', 'disable'].includes(args[1])) {
    if (unknownOptions(args, 1, ['--host', '--target', '--json', '--dry-run', '--apply'])
      || optionValue(args, '--host') !== 'codex'
      || !explicitWriteBoundary(args)) {
      io.stderr.write(USAGE);
      return 2;
    }
    const plan = await planProjectAutomation({ target: root, enabled: args[1] === 'enable', fs: nodeFilesystem });
    if (!plan.ok || args.includes('--dry-run')) {
      writeStructured(publicAutomationPlan(plan), json, io);
      return plan.ok ? 0 : 1;
    }
    try {
      const applied = await applyProjectAutomation(plan, nodeFilesystem);
      writeStructured(publicAutomationPlan(plan, applied), json, io);
      return 0;
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return 3;
    }
  }

  if (command === 'check') {
    if (unknownOptions(args, 0, ['--target', '--json'])) {
      io.stderr.write(USAGE);
      return 2;
    }
    const result = await validateProject(root);
    writeResult(result, json, io);
    return result.ok ? 0 : 1;
  }

  if (['init', 'adopt', 'upgrade'].includes(command)) {
    if (unknownOptions(args, 0, ['--target', '--json', '--dry-run', '--apply', '--profile', '--adoption-config']) || (args.includes('--apply') && args.includes('--dry-run'))) {
      io.stderr.write(USAGE);
      return 2;
    }
    const profile = optionValue(args, '--profile');
    const adoptionConfigPath = optionValue(args, '--adoption-config');
    if ((args.includes('--profile') && !profile) || (args.includes('--adoption-config') && !adoptionConfigPath)) {
      io.stderr.write('--profile and --adoption-config require values\n');
      return 2;
    }
    if (command === 'adopt' && (profile || adoptionConfigPath)) {
      if (profile !== EXISTING_REPOSITORY_PROFILE || !adoptionConfigPath) {
        io.stderr.write('existing-repository adoption requires --profile existing-repository and --adoption-config FILE\n');
        return 2;
      }
      let input;
      try {
        input = JSON.parse(await nodeFilesystem.readText(resolve(adoptionConfigPath)));
      } catch (error) {
        io.stderr.write(`Cannot load adoption config: ${error.message}\n`);
        return 2;
      }
      const normalized = normalizeAdoptionConfig(input);
      if (!normalized.ok) {
        writeStructured(normalized, json, io);
        return 2;
      }
      const plan = await planExistingRepositoryAdoption({ target: root, config: normalized.config, fs: nodeFilesystem });
      let applied = null;
      if (plan.ok && args.includes('--apply')) applied = await applyScaffold(plan, nodeFilesystem);
      writeStructured(publicScaffoldPlan(plan, applied), json, io);
      return plan.ok ? 0 : 1;
    }
    if ((profile || adoptionConfigPath) && command !== 'adopt') {
      io.stderr.write('--profile and --adoption-config are supported only by adopt\n');
      return 2;
    }
    let plan;
    if (command === 'upgrade') {
      let storedProfile = null;
      try {
        storedProfile = JSON.parse(await nodeFilesystem.readText(resolve(root, '.context-rail/config.json'))).profile;
      } catch {
        // The native scaffold planner reports missing or malformed metadata as before.
      }
      plan = storedProfile === EXISTING_REPOSITORY_PROFILE
        ? await planExistingRepositoryUpgrade({ target: root, fs: nodeFilesystem })
        : await planScaffold({ mode: command, target: root, templateRoot: PROJECT_TEMPLATE, fs: nodeFilesystem });
    } else {
      plan = await planScaffold({ mode: command, target: root, templateRoot: PROJECT_TEMPLATE, fs: nodeFilesystem });
    }
    let applied = null;
    if (plan.ok && args.includes('--apply')) applied = await applyScaffold(plan, nodeFilesystem);
    writeStructured(publicScaffoldPlan(plan, applied), json, io);
    return plan.ok ? 0 : 1;
  }

  if (command === 'route') {
    if (unknownOptions(args, 1, ['--target', '--json'])) {
      io.stderr.write(USAGE);
      return 2;
    }
    const path = args.slice(1).find((value, index, values) => !value.startsWith('--') && values[index - 1] !== '--target');
    if (!path) {
      io.stderr.write(USAGE);
      return 2;
    }
    try {
      writeStructured(await buildRoute(root, path), json, io);
      return 0;
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return 2;
    }
  }

  if (command === 'continue') {
    if (unknownOptions(args, 0, ['--target', '--json'])) {
      io.stderr.write(USAGE);
      return 2;
    }
    const result = await buildContinuation(root);
    writeStructured(result, json, io);
    return result.status === 'ready' ? 0 : 1;
  }

  if (command === 'measure' && args[1] === 'record') {
    const supported = ['--target', '--json', '--task', '--session', '--source', ...METRIC_OPTIONS.keys()];
    if (unknownOptions(args, 1, supported)) {
      io.stderr.write(USAGE);
      return 2;
    }
    const taskId = optionValue(args, '--task');
    const source = optionValue(args, '--source');
    const session = optionValue(args, '--session') ?? 'local';
    if (!taskId || !source) {
      io.stderr.write('measure record requires --task and --source\n');
      return 2;
    }
    const metrics = {};
    for (const [option, name] of METRIC_OPTIONS) {
      const raw = optionValue(args, option);
      if (raw === null) continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        io.stderr.write(`${option} requires a number\n`);
        return 2;
      }
      metrics[name] = value;
    }
    const record = {
      schema: 1,
      recordedAt: new Date().toISOString(),
      taskId,
      sessionIdHash: createHash('sha256').update(session).digest('hex'),
      source,
      metrics,
    };
    try {
      const result = await appendMeasurement(root, record, nodeFilesystem);
      writeStructured({ ...result, record: { ...record, sessionIdHash: '[sha256]' } }, json, io);
      return 0;
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return 2;
    }
  }

  if (command === 'measure' && args[1] === 'report') {
    if (unknownOptions(args, 1, ['--target', '--json'])) {
      io.stderr.write(USAGE);
      return 2;
    }
    writeStructured(summarizeMeasurements(await readMeasurements(root, nodeFilesystem)), json, io);
    return 0;
  }

  if (command === 'throughline' && args[1] === 'prepare') {
    if (unknownOptions(args, 1, ['--target', '--json', '--dry-run']) || !args.includes('--dry-run')) {
      io.stderr.write('throughline prepare currently requires --dry-run\n');
      return 2;
    }
    const loaded = await loadThroughlineManifest(root, nodeFilesystem);
    if (!loaded.ok) {
      writeStructured(loaded, json, io);
      return 1;
    }
    writeStructured(planPreparation(loaded.manifest), json, io);
    return 0;
  }

  if (command === 'throughline' && args[1] === 'install') {
    if (unknownOptions(args, 1, ['--target', '--json', '--dry-run', '--apply', '--managed-root', '--artifact']) || (args.includes('--dry-run') === args.includes('--apply'))) {
      io.stderr.write(USAGE);
      return 2;
    }
    const loaded = await loadThroughlineManifest(root, nodeFilesystem);
    if (!loaded.ok) {
      writeStructured(loaded, json, io);
      return 1;
    }
    const managedRoot = resolve(optionValue(args, '--managed-root') ?? joinHome(dependencies.home ?? homedir(), '.local/share/contextrail/throughline'));
    const artifact = resolve(optionValue(args, '--artifact') ?? resolve(root, `.context-rail/runtime/throughline/throughline-${loaded.manifest.packageVersion}.tgz`));
    const plan = planManagedInstall({ managedRoot, artifact, version: loaded.manifest.packageVersion, manifest: loaded.manifest });
    if (args.includes('--dry-run')) {
      const { manifest, ...publicPlan } = plan;
      writeStructured({ ...publicPlan, applyRequired: true, artifactPrepared: await nodeFilesystem.exists(artifact) }, json, io);
      return 0;
    }
    if (!optionValue(args, '--artifact')) {
      io.stderr.write('throughline install --apply requires --artifact\n');
      return 2;
    }
    try {
      const result = await applyManagedInstall({
        plan,
        apply: true,
        home: dependencies.home ?? homedir(),
        fs: nodeFilesystem,
        processAdapter: dependencies.processAdapter ?? nodeProcess,
      });
      writeStructured(result, json, io);
      return 0;
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return 3;
    }
  }

  if (command === 'throughline' && args[1] === 'verify') {
    if (unknownOptions(args, 1, ['--target', '--json', '--binary', '--doctor'])) {
      io.stderr.write(USAGE);
      return 2;
    }
    const adapter = dependencies.processAdapter ?? nodeProcess;
    const binary = optionValue(args, '--binary') ?? 'throughline';
    const result = await verifyThroughline({ binary, processAdapter: adapter });
    writeStructured(result, json, io);
    if (args.includes('--doctor') && !json) {
      const doctor = await adapter.run(binary, ['doctor', '--codex'], { timeoutMs: 30000 });
      io.stdout.write(doctor.stdout);
      if (doctor.stderr) io.stderr.write(doctor.stderr);
    }
    return ['hooks_ready', 'capture_verified'].includes(result.state) ? 0 : 3;
  }

  if (command === 'throughline' && args[1] === 'rollback') {
    if (unknownOptions(args, 1, ['--target', '--json', '--apply', '--managed-root']) || !args.includes('--apply')) {
      io.stderr.write(USAGE);
      return 2;
    }
    const managedRoot = resolve(optionValue(args, '--managed-root') ?? joinHome(dependencies.home ?? homedir(), '.local/share/contextrail/throughline'));
    try {
      const result = await rollbackManagedInstall({
        managedRoot,
        apply: true,
        home: dependencies.home ?? homedir(),
        fs: nodeFilesystem,
        processAdapter: dependencies.processAdapter ?? nodeProcess,
      });
      writeStructured(result, json, io);
      return 0;
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return 3;
    }
  }

  io.stderr.write(USAGE);
  return 2;
}

export { validateProject };

function joinHome(home, suffix) {
  return resolve(home, ...suffix.split('/'));
}
