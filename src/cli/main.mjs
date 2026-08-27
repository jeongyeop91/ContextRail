import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nodeFilesystem } from '../adapters/filesystem.mjs';
import { buildContinuation } from '../core/continuity.mjs';
import { validateDocuments } from '../core/documents.mjs';
import { appendMeasurement, readMeasurements, summarizeMeasurements } from '../core/measurement.mjs';
import { finish, issue } from '../core/result.mjs';
import { buildRoute } from '../core/routing.mjs';
import { applyScaffold, planScaffold } from '../core/scaffold.mjs';
import { validateState } from '../core/state.mjs';

const PROJECT_TEMPLATE = resolve(dirname(fileURLToPath(import.meta.url)), '../../templates/project');
const USAGE = `Usage:
  contextrail init|adopt|upgrade [--target PATH] [--dry-run|--apply] [--json]
  contextrail check [--target PATH] [--json]
  contextrail route PATH [--target PATH] [--json]
  contextrail continue [--target PATH] [--json]
  contextrail measure record --task ID --source SOURCE [metric options] [--target PATH] [--json]
  contextrail measure report [--target PATH] [--json]
`;

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

function unknownOptions(args, positionalCount, supported) {
  const options = new Set(supported);
  const flags = new Set(['--json', '--dry-run', '--apply']);
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

export async function run(args = process.argv.slice(2), io = process) {
  const command = args[0];
  const targetValue = optionValue(args, '--target');
  if (args.includes('--target') && !targetValue) {
    io.stderr.write('--target requires a path\n');
    return 2;
  }
  const root = resolve(targetValue ?? process.cwd());
  const json = args.includes('--json');

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
    if (unknownOptions(args, 0, ['--target', '--json', '--dry-run', '--apply']) || (args.includes('--apply') && args.includes('--dry-run'))) {
      io.stderr.write(USAGE);
      return 2;
    }
    const plan = await planScaffold({ mode: command, target: root, templateRoot: PROJECT_TEMPLATE, fs: nodeFilesystem });
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

  io.stderr.write(USAGE);
  return 2;
}

export { validateProject };
