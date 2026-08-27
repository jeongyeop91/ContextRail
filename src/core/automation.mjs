import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

import { finish, issue } from './result.mjs';

const CONFIG_PATH = '.context-rail/config.json';
const VERSION_PATH = '.context-rail/version.json';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function codexAutomation(config) {
  const value = config?.automation?.codex;
  return {
    enabled: value?.enabled === true,
    promptRouting: value?.promptRouting === true,
    stopCheck: value?.stopCheck === true,
  };
}

async function loadOwnedFiles(target, fs, issues) {
  try {
    const configText = await fs.readText(resolve(target, CONFIG_PATH));
    const versionText = await fs.readText(resolve(target, VERSION_PATH));
    return {
      configText,
      config: JSON.parse(configText),
      versionText,
      version: JSON.parse(versionText),
    };
  } catch (error) {
    issues.push(issue('INVALID_AUTOMATION_METADATA', '.context-rail', `Cannot load ContextRail metadata: ${error.message}`));
    return null;
  }
}

export async function planProjectAutomation({ target, enabled, fs }) {
  const root = resolve(target);
  const issues = [];
  const loaded = await loadOwnedFiles(root, fs, issues);
  if (!loaded) return { ...finish(issues), mode: enabled ? 'enable' : 'disable', target: root, operations: [] };

  const configHash = sha256(loaded.configText);
  if (loaded.version.ownedFiles?.[CONFIG_PATH] !== configHash) {
    issues.push(issue('AUTOMATION_CONFIG_NOT_OWNED', CONFIG_PATH, 'Config content does not match its recorded owned hash'));
    return { ...finish(issues), mode: enabled ? 'enable' : 'disable', target: root, operations: [] };
  }

  const current = codexAutomation(loaded.config);
  const nextCodex = enabled
    ? { enabled: true, promptRouting: true, stopCheck: true }
    : { ...current, enabled: false };
  const nextConfig = structuredClone(loaded.config);
  nextConfig.automation = { ...(nextConfig.automation ?? {}), codex: nextCodex };
  const configContent = json(nextConfig);
  const nextVersion = structuredClone(loaded.version);
  nextVersion.ownedFiles = {
    ...(nextVersion.ownedFiles ?? {}),
    [CONFIG_PATH]: sha256(configContent),
  };
  const versionContent = json({
    ...nextVersion,
    ownedFiles: Object.fromEntries(Object.entries(nextVersion.ownedFiles).sort(([left], [right]) => left.localeCompare(right))),
  });
  const operations = [
    {
      action: configContent === loaded.configText ? 'skip' : 'update',
      path: CONFIG_PATH,
      content: configContent,
      beforeContent: loaded.configText,
      beforeHash: configHash,
      contentHash: sha256(configContent),
    },
    {
      action: versionContent === loaded.versionText ? 'skip' : 'update',
      path: VERSION_PATH,
      content: versionContent,
      beforeContent: loaded.versionText,
      beforeHash: sha256(loaded.versionText),
      contentHash: sha256(versionContent),
    },
  ];
  return {
    ...finish(issues, { enabled: nextCodex.enabled, updates: operations.filter((entry) => entry.action === 'update').length }),
    mode: enabled ? 'enable' : 'disable',
    target: root,
    operations,
  };
}

export async function applyProjectAutomation(plan, fs) {
  if (!plan.ok) throw new Error('Cannot apply an invalid automation plan');
  for (const operation of plan.operations) {
    const live = await fs.readText(resolve(plan.target, operation.path));
    if (sha256(live) !== operation.beforeHash) throw new Error(`Automation apply refused because of concurrent change in ${operation.path}`);
  }

  const updates = plan.operations.filter((entry) => entry.action === 'update');
  if (updates.length === 0) return { ok: true, applied: [] };
  const suffix = `.tmp-${process.pid}-${Date.now()}`;
  const temporaryPaths = [];
  try {
    for (const operation of updates) {
      const destination = resolve(plan.target, operation.path);
      await fs.mkdir(dirname(destination), { recursive: true });
      const temporary = `${destination}${suffix}`;
      await fs.writeText(temporary, operation.content);
      temporaryPaths.push(temporary);
    }
    for (let index = 0; index < updates.length; index += 1) {
      await fs.rename(temporaryPaths[index], resolve(plan.target, updates[index].path));
    }
    return { ok: true, applied: updates.map((entry) => entry.path) };
  } catch (error) {
    for (const operation of updates) {
      await fs.writeText(resolve(plan.target, operation.path), operation.beforeContent);
    }
    for (const temporary of temporaryPaths) {
      if (await fs.exists(temporary)) await fs.remove(temporary, { force: true });
    }
    throw error;
  }
}
