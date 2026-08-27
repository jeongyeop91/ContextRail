import { resolve } from 'node:path';

import { nodeFilesystem } from '../adapters/filesystem.mjs';
import { issue } from './result.mjs';
import { buildRoute, loadConfig } from './routing.mjs';
import { parseCurrentItem } from './state.mjs';

function pendingSteps(plan) {
  return [...plan.matchAll(/^\s*- \[ \]\s+(.+)$/gm)].slice(0, 2).map((match) => match[1].trim());
}

export async function buildContinuation(root, options = {}) {
  const fs = options.fs ?? nodeFilesystem;
  const config = options.config ?? await loadConfig(root, fs, options.configPath);
  if (config.state.mode === 'references') {
    const route = await buildRoute(root, '.', { fs, config });
    return {
      status: 'ready',
      continuityMode: 'references',
      instructionFiles: route.instructionFiles,
      documentRouter: config.documentRouter,
      current: config.state.current,
      planDirectory: config.state.planDirectory,
      backlog: config.state.backlog,
      validationHints: config.validationHints ?? [],
      message: 'Read the referenced current state and backlog in their project-specific format, then determine the next task without guessing or converting them.',
    };
  }
  const currentText = await fs.readText(resolve(root, config.state.current));
  const planText = await fs.readText(resolve(root, config.state.plan));
  const backlog = JSON.parse(await fs.readText(resolve(root, config.state.backlog)));
  const activeId = parseCurrentItem(currentText);
  const inProgress = backlog.items.filter((entry) => entry.status === 'in_progress');
  const issues = [];
  let currentItem = activeId ? backlog.items.find((entry) => entry.id === activeId) : null;

  if (activeId && !currentItem) issues.push(issue('CURRENT_ITEM_MISSING', config.state.current, `Unknown active item ${activeId}`));
  if (currentItem?.status === 'blocked') issues.push(issue('CURRENT_ITEM_BLOCKED', config.state.current, `${currentItem.id} is blocked`));
  if (activeId && inProgress.length === 1 && inProgress[0].id !== activeId) {
    issues.push(issue('CURRENT_IN_PROGRESS_MISMATCH', config.state.current, `Active item does not match ${inProgress[0].id}`));
  }
  if (!activeId) {
    const ready = backlog.items.filter((entry) => entry.status === 'ready');
    if (ready.length === 1) currentItem = ready[0];
    else issues.push(issue(ready.length === 0 ? 'NO_READY_ITEM' : 'AMBIGUOUS_READY_ITEMS', config.state.backlog, 'Cannot select a unique ready item'));
  }
  if (currentItem && !['in_progress', 'blocked', 'ready'].includes(currentItem.status)) {
    issues.push(issue('CURRENT_ITEM_NOT_ACTIONABLE', config.state.current, `${currentItem.id} has status ${currentItem.status}`));
  }

  const route = await buildRoute(root, '.', { fs, config });
  return {
    status: issues.length === 0 ? 'ready' : 'needs_input',
    issues,
    instructionFiles: route.instructionFiles,
    currentItem,
    planSteps: pendingSteps(planText),
    nextSteps: currentItem?.nextSteps ?? [],
    authorityFiles: currentItem?.authority ?? [],
    sourceHints: currentItem?.sourceHints ?? [],
    validation: currentItem?.validation ?? [],
  };
}
