import { resolve } from 'node:path';

import { nodeFilesystem } from '../adapters/filesystem.mjs';
import { validateDocuments } from '../core/documents.mjs';
import { finish, issue } from '../core/result.mjs';
import { validateState } from '../core/state.mjs';

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

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

export async function run(args = process.argv.slice(2), io = process) {
  const command = args[0];
  if (command !== 'check') {
    io.stderr.write('Usage: contextrail check [--target PATH] [--json]\n');
    return 2;
  }
  const targetValue = optionValue(args, '--target');
  if (args.includes('--target') && !targetValue) {
    io.stderr.write('--target requires a path\n');
    return 2;
  }
  const allowed = new Set(['check', '--json', '--target', targetValue]);
  if (args.some((arg) => !allowed.has(arg))) {
    io.stderr.write(`Unknown option for check\n`);
    return 2;
  }
  const result = await validateProject(resolve(targetValue ?? process.cwd()));
  writeResult(result, args.includes('--json'), io);
  return result.ok ? 0 : 1;
}

export { validateProject };
