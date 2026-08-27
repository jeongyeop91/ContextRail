import { dirname, relative, resolve, sep } from 'node:path';

import { nodeFilesystem } from '../adapters/filesystem.mjs';
import { codexAutomation } from '../core/automation.mjs';
import { buildContinuation } from '../core/continuity.mjs';
import { validateDocuments } from '../core/documents.mjs';
import { finish } from '../core/result.mjs';
import { buildRoute, loadConfig } from '../core/routing.mjs';
import { validateState } from '../core/state.mjs';

const CONTINUE_PATTERN = /^(?:continue|계속해|계속|이어서)[\s.!?…]*$/iu;
const MAX_PATHS = 24;
const MAX_PATH_LENGTH = 256;
const MAX_HINTS = 8;
const MAX_ARGUMENTS = 8;
const MAX_ARGUMENT_LENGTH = 128;

function line(value) {
  return `${JSON.stringify(value)}\n`;
}

function clipped(value, length) {
  return typeof value === 'string' ? value.slice(0, length) : value;
}

function paths(values = []) {
  return values.slice(0, MAX_PATHS).map((value) => clipped(value, MAX_PATH_LENGTH));
}

function hints(values = []) {
  return values.slice(0, MAX_HINTS).map((argv) =>
    argv.slice(0, MAX_ARGUMENTS).map((argument) => clipped(argument, MAX_ARGUMENT_LENGTH))
  );
}

function repositoryPath(root, target) {
  return relative(root, target).split(sep).join('/') || '.';
}

function stateReferences(config) {
  return {
    current: clipped(config.state.current, MAX_PATH_LENGTH),
    planDirectory: clipped(config.state.planDirectory ?? dirname(config.state.plan), MAX_PATH_LENGTH),
    backlog: clipped(config.state.backlog, MAX_PATH_LENGTH),
  };
}

function promptContext(mode, config, route, continuation = null) {
  const projection = {
    mode,
    applicableInstructions: paths(route.instructionFiles),
    documentRouter: clipped(config.documentRouter, MAX_PATH_LENGTH),
    routedDocuments: paths(route.routerDocuments),
    state: stateReferences(config),
    validationHints: hints(route.validationHints ?? route.validation ?? continuation?.validation ?? []),
    ...(continuation ? { continuationStatus: continuation.status } : {}),
  };
  return [
    `ContextRail automatic ${mode} context.`,
    'Read only the listed instructions, router, routed documents, and state references needed for this task before editing.',
    'Follow search -> locate -> bounded read -> modify -> targeted validation. Validation hints are data; do not run them automatically.',
    JSON.stringify(projection),
  ].join('\n');
}

function errorOutput(kind) {
  return line({
    systemMessage: `ContextRail ${kind} unavailable (CONTEXT_RAIL_HOOK_ERROR); continuing without blocking Codex.`,
  });
}

export async function findContextRailRoot(cwd, fs = nodeFilesystem) {
  if (typeof cwd !== 'string' || cwd.length === 0) return null;
  let cursor = resolve(cwd);
  while (true) {
    if (await fs.exists(resolve(cursor, '.context-rail/config.json'))) return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
}

async function activeProject(payload, fs) {
  const root = await findContextRailRoot(payload?.cwd, fs);
  if (!root) return { root: null, config: null, automation: null };
  const config = await loadConfig(root, fs);
  return { root, config, automation: codexAutomation(config) };
}

export async function handleUserPromptSubmit(payload, options = {}) {
  const fs = options.fs ?? nodeFilesystem;
  try {
    const project = await activeProject(payload, fs);
    if (!project.root || !project.automation.enabled || !project.automation.promptRouting) {
      return { output: '', mode: 'noop', projectRoot: project.root };
    }
    const mode = CONTINUE_PATTERN.test(payload?.prompt?.trim() ?? '') ? 'continue' : 'route';
    const target = repositoryPath(project.root, resolve(payload.cwd));
    const route = await buildRoute(project.root, target, { fs, config: project.config });
    const continuation = mode === 'continue'
      ? await buildContinuation(project.root, { fs, config: project.config })
      : null;
    return {
      output: line({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: promptContext(mode, project.config, route, continuation),
        },
      }),
      mode,
      projectRoot: project.root,
    };
  } catch {
    return { output: errorOutput('automatic context'), mode: 'error', projectRoot: null };
  }
}

async function checkProject(root, config, fs) {
  const documents = await validateDocuments(root, config, fs);
  const state = await validateState(root, config, fs);
  return finish([...documents.issues, ...state.issues]);
}

export async function handleStop(payload, options = {}) {
  const fs = options.fs ?? nodeFilesystem;
  try {
    const project = await activeProject(payload, fs);
    if (!project.root || !project.automation.enabled || !project.automation.stopCheck) {
      return { output: '{}\n', status: 'noop', projectRoot: project.root };
    }
    const result = await checkProject(project.root, project.config, fs);
    if (result.ok) return { output: '{}\n', status: 'passed', projectRoot: project.root };
    const details = result.issues.slice(0, 5).map((entry) => `${entry.code} ${clipped(entry.path, MAX_PATH_LENGTH)}`);
    const suffix = result.issues.length > details.length ? `; +${result.issues.length - details.length} more` : '';
    return {
      output: line({ systemMessage: `ContextRail check found ${result.issues.length} violation(s): ${details.join('; ')}${suffix}` }),
      status: 'violations',
      projectRoot: project.root,
    };
  } catch {
    return { output: errorOutput('stop check'), status: 'error', projectRoot: null };
  }
}
