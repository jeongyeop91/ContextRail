import { join, resolve } from 'node:path';

import { finish, issue } from './result.mjs';

export const BACKLOG_STATUSES = new Set(['proposed', 'ready', 'in_progress', 'blocked', 'done', 'dropped']);

export function parseCurrentItem(markdown) {
  const match = /^Active item:\s+`([^`]+)`\s*$/m.exec(markdown);
  return match ? match[1] : null;
}

function hasCycle(itemsById) {
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id) || !itemsById.has(id)) return false;
    visiting.add(id);
    for (const dependency of itemsById.get(id).dependsOn ?? []) if (visit(dependency)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  return [...itemsById.keys()].some(visit);
}

function validValidation(value) {
  return Array.isArray(value) && value.every(
    (argv) => Array.isArray(argv) && argv.length > 0 && argv.every((part) => typeof part === 'string' && part.length > 0),
  );
}

export async function readState(root, config, fs) {
  const currentText = await fs.readText(resolve(root, config.state.current));
  const backlog = JSON.parse(await fs.readText(resolve(root, config.state.backlog)));
  return { currentText, activeId: parseCurrentItem(currentText), backlog };
}

export async function validateState(root, config, fs) {
  const issues = [];
  const { current, plan, backlog: backlogPath } = config.state;
  for (const [code, path] of [['MISSING_CURRENT', current], ['MISSING_BACKLOG', backlogPath]]) {
    if (!(await fs.exists(resolve(root, path)))) issues.push(issue(code, path, 'Required state file does not exist'));
  }

  const stateRoot = resolve(root, join(plan, '..'));
  const planNames = (await fs.exists(stateRoot))
    ? (await fs.list(stateRoot)).filter((name) => /^PLAN(?:[-.].*)?\.md$/i.test(name))
    : [];
  if (planNames.length === 0) issues.push(issue('MISSING_ACTIVE_PLAN', plan, 'No active plan exists'));
  if (planNames.length > 1) issues.push(issue('MULTIPLE_ACTIVE_PLANS', join(plan, '..'), 'More than one active plan exists'));
  if (issues.some((entry) => entry.code === 'MISSING_CURRENT' || entry.code === 'MISSING_BACKLOG')) return finish(issues);

  let state;
  try {
    state = await readState(root, config, fs);
  } catch (error) {
    issues.push(issue('INVALID_BACKLOG_JSON', backlogPath, `Backlog is not valid JSON: ${error.message}`));
    return finish(issues);
  }

  const items = Array.isArray(state.backlog.items) ? state.backlog.items : [];
  const counts = new Map();
  for (const item of items) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  for (const [id, count] of counts) if (count > 1) issues.push(issue('DUPLICATE_BACKLOG_ID', backlogPath, `Duplicate backlog ID: ${id}`));

  const itemsById = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    if (!BACKLOG_STATUSES.has(item.status)) issues.push(issue('INVALID_BACKLOG_STATUS', backlogPath, `Invalid status for ${item.id}: ${item.status}`));
    if (!validValidation(item.validation)) issues.push(issue('INVALID_VALIDATION_ARGV', backlogPath, `Validation for ${item.id} must be argv arrays`));
    for (const dependency of item.dependsOn ?? []) {
      if (!itemsById.has(dependency)) issues.push(issue('UNKNOWN_DEPENDENCY', backlogPath, `${item.id} depends on unknown item ${dependency}`));
    }
  }
  if (hasCycle(itemsById)) issues.push(issue('CYCLIC_DEPENDENCY', backlogPath, 'Backlog dependencies contain a cycle'));

  const inProgress = items.filter((item) => item.status === 'in_progress');
  if (inProgress.length > 1) issues.push(issue('MULTIPLE_IN_PROGRESS', backlogPath, 'More than one item is in progress'));
  if (state.activeId) {
    const currentItem = itemsById.get(state.activeId);
    if (!currentItem) issues.push(issue('CURRENT_ITEM_MISSING', current, `CURRENT references unknown item ${state.activeId}`));
    else if (!['in_progress', 'blocked'].includes(currentItem.status)) {
      issues.push(issue('CURRENT_ITEM_NOT_ACTIVE', current, `CURRENT item ${state.activeId} has status ${currentItem.status}`));
    }
    if (inProgress.length === 1 && inProgress[0].id !== state.activeId) {
      issues.push(issue('CURRENT_IN_PROGRESS_MISMATCH', current, `CURRENT does not match in-progress item ${inProgress[0].id}`));
    }
  } else if (inProgress.length > 0) {
    issues.push(issue('CURRENT_IN_PROGRESS_MISMATCH', current, 'CURRENT has no active item but backlog has in-progress work'));
  }

  return finish(issues, { activeId: state.activeId, backlogItems: items.length, inProgress: inProgress.length });
}
