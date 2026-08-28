import { createHash } from 'node:crypto';
import { dirname, isAbsolute, resolve } from 'node:path';

import { nodeFilesystem } from '../adapters/filesystem.mjs';
import { finish, issue } from '../core/result.mjs';

const HOOKS_PATH = '.codex/hooks.json';
const CONFIG_PATH = '.codex/config.toml';
const RECEIPT_PATH = '.codex/contextrail/hooks-receipt.json';
const OWNER_PREFIX = 'ContextRail:';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function contentHash(value) {
  return value === null ? 'absent' : sha256(value);
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function optionalText(fs, path) {
  return await fs.exists(path) ? fs.readText(path) : null;
}

function posixQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function powerShellQuote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function encodePosixCommand(argv) {
  return argv.map(posixQuote).join(' ');
}

export function encodePowerShellCommand(argv) {
  return `& ${argv.map(powerShellQuote).join(' ')}`;
}

function desiredEntries(nodePath, cliPath) {
  const command = (eventName) => encodePosixCommand([nodePath, cliPath, 'hook', eventName]);
  const commandWindows = (eventName) => encodePowerShellCommand([nodePath, cliPath, 'hook', eventName]);
  return [
    {
      event: 'UserPromptSubmit',
      group: {
        hooks: [{
          type: 'command',
          command: command('user-prompt-submit'),
          commandWindows: commandWindows('user-prompt-submit'),
          timeout: 10,
          statusMessage: 'ContextRail: routing project context',
          additionalContextLimit: 2000,
        }],
      },
    },
    {
      event: 'Stop',
      group: {
        hooks: [{
          type: 'command',
          command: command('stop'),
          commandWindows: commandWindows('stop'),
          timeout: 30,
          statusMessage: 'ContextRail: checking project contracts',
        }],
      },
    },
  ];
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function ownedHandler(handler) {
  return handler?.type === 'command' && typeof handler.statusMessage === 'string' && handler.statusMessage.startsWith(OWNER_PREFIX);
}

function groupHasOwnedHandler(group) {
  return (group?.hooks ?? [group]).some(ownedHandler);
}

function parseHooks(content, issues = []) {
  if (content === null) return { hooks: {} };
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.hooks || typeof parsed.hooks !== 'object' || Array.isArray(parsed.hooks)) {
      throw new Error('Expected an object with a hooks object');
    }
    for (const [event, groups] of Object.entries(parsed.hooks)) {
      if (!Array.isArray(groups)) throw new Error(`Expected hooks.${event} to be an array`);
    }
    return parsed;
  } catch (error) {
    issues.push(issue('INVALID_CODEX_HOOKS', HOOKS_PATH, `Cannot load Codex hooks: ${error.message}`));
    return null;
  }
}

function appendEntries(hooks, entries) {
  const next = structuredClone(hooks);
  for (const entry of entries) {
    next.hooks[entry.event] = [...(next.hooks[entry.event] ?? []), structuredClone(entry.group)];
  }
  return next;
}

function removeEntries(hooks, entries) {
  const next = structuredClone(hooks);
  for (const entry of entries) {
    const groups = next.hooks[entry.event] ?? [];
    const index = groups.findIndex((group) => same(group, entry.group));
    if (index === -1) throw new Error(`Owned ${entry.event} Hook entry is missing`);
    groups.splice(index, 1);
    if (groups.length === 0) delete next.hooks[entry.event];
  }
  return next;
}

function nonOwnedDigest(hooks, entries) {
  const next = structuredClone(hooks);
  for (const [event, groups] of Object.entries(next.hooks)) {
    const filtered = groups.filter((group) => !entries.some((entry) => entry.event === event && same(entry.group, group)));
    if (filtered.length === 0) delete next.hooks[event];
    else next.hooks[event] = filtered;
  }
  return sha256(JSON.stringify(next));
}

function featuresSection(lines) {
  const start = lines.findIndex((line) => /^\s*\[features\]\s*(?:#.*)?$/.test(line));
  if (start === -1) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return { start, end };
}

function featureState(content) {
  if (content === null) return { enabled: true, key: 'default', value: null };
  const lines = content.split('\n');
  const section = featuresSection(lines);
  if (!section) return { enabled: true, key: 'default', value: null };
  let canonical = null;
  let deprecated = null;
  for (let index = section.start + 1; index < section.end; index += 1) {
    const match = /^\s*(hooks|codex_hooks)\s*=\s*(true|false)\s*(?:#.*)?$/.exec(lines[index]);
    if (!match) continue;
    const state = { enabled: match[2] === 'true', key: match[1], value: match[2], index };
    if (match[1] === 'hooks') canonical = state;
    else deprecated = state;
  }
  return canonical ?? deprecated ?? { enabled: true, key: 'default', value: null };
}

function receiptConfigCurrent(content, receipt) {
  if (receipt.hashes?.configAfter === contentHash(content)) return true;
  return receipt.featureEdit?.type === 'none' && featureState(content).enabled;
}

function enableFeature(content) {
  const state = featureState(content);
  if (state.enabled) return { content, edit: { type: 'none' } };
  const lines = content.split('\n');
  if (state.key === 'hooks') {
    const beforeLine = lines[state.index];
    const afterLine = beforeLine.replace(/(hooks\s*=\s*)false/, '$1true');
    lines[state.index] = afterLine;
    return { content: lines.join('\n'), edit: { type: 'replace', beforeLine, afterLine } };
  }
  const section = featuresSection(lines);
  const insertedLine = 'hooks = true';
  lines.splice(section.start + 1, 0, insertedLine);
  return { content: lines.join('\n'), edit: { type: 'insert', insertedLine } };
}

function reverseFeature(content, edit) {
  if (edit?.type === 'none') return content;
  if (content === null) throw new Error('Codex config disappeared after installation');
  const lines = content.split('\n');
  if (edit.type === 'replace') {
    const matches = lines.map((line, index) => line === edit.afterLine ? index : -1).filter((index) => index !== -1);
    if (matches.length !== 1) throw new Error('Changed Codex feature flag is not uniquely restorable');
    lines[matches[0]] = edit.beforeLine;
    return lines.join('\n');
  }
  if (edit.type === 'insert') {
    const matches = lines.map((line, index) => line === edit.insertedLine ? index : -1).filter((index) => index !== -1);
    if (matches.length !== 1) throw new Error('Inserted Codex feature flag is not uniquely removable');
    lines.splice(matches[0], 1);
    return lines.join('\n');
  }
  throw new Error('Unknown Codex feature edit');
}

async function homeSnapshot(home, fs) {
  return {
    hooks: await optionalText(fs, resolve(home, HOOKS_PATH)),
    config: await optionalText(fs, resolve(home, CONFIG_PATH)),
    receipt: await optionalText(fs, resolve(home, RECEIPT_PATH)),
  };
}

async function restoreSnapshot(home, snapshot, fs) {
  for (const [path, content] of [
    [HOOKS_PATH, snapshot.hooks],
    [CONFIG_PATH, snapshot.config],
    [RECEIPT_PATH, snapshot.receipt],
  ]) {
    const destination = resolve(home, path);
    if (content === null) await fs.remove(destination, { force: true });
    else {
      await fs.mkdir(dirname(destination), { recursive: true });
      await fs.writeText(destination, content);
    }
  }
}

function hashes(snapshot) {
  return {
    hooks: contentHash(snapshot.hooks),
    config: contentHash(snapshot.config),
    receipt: contentHash(snapshot.receipt),
  };
}

function publicFiles(before, after) {
  return [
    { path: HOOKS_PATH, action: before.hooks === after.hooks ? 'skip' : (before.hooks === null ? 'create' : 'update') },
    { path: CONFIG_PATH, action: before.config === after.config ? 'skip' : (before.config === null ? 'create' : 'update') },
    { path: RECEIPT_PATH, action: before.receipt === after.receipt ? 'skip' : (before.receipt === null ? 'create' : 'update') },
  ];
}

function entryCounts(hooks, entry) {
  const groups = hooks.hooks[entry.event] ?? [];
  return {
    exact: groups.filter((group) => same(group, entry.group)).length,
    owned: groups.filter(groupHasOwnedHandler).length,
  };
}

export async function planCodexHooksInstall({ home, nodePath, cliPath, fs = nodeFilesystem }) {
  const root = resolve(home);
  const issues = [];
  if (!isAbsolute(nodePath) || !isAbsolute(cliPath)) {
    issues.push(issue('CODEX_HOOK_PATH_NOT_ABSOLUTE', HOOKS_PATH, 'Node and ContextRail CLI paths must be absolute'));
  }
  const before = await homeSnapshot(root, fs);
  const parsed = parseHooks(before.hooks, issues);
  const entries = isAbsolute(nodePath) && isAbsolute(cliPath) ? desiredEntries(nodePath, cliPath) : [];
  let receipt = null;
  if (before.receipt !== null) {
    try {
      receipt = JSON.parse(before.receipt);
    } catch (error) {
      issues.push(issue('INVALID_CODEX_HOOK_RECEIPT', RECEIPT_PATH, `Cannot load receipt: ${error.message}`));
    }
  }
  if (!parsed || issues.length > 0) {
    return { ...finish(issues), status: 'conflict', home: root, files: [], entries, hashes: hashes(before), before };
  }

  const counts = entries.map((entry) => entryCounts(parsed, entry));
  if (receipt) {
    const live = hashes(before);
    const ownedCurrent = counts.every((count) => count.exact === 1 && count.owned === 1)
      && receiptConfigCurrent(before.config, receipt);
    if (ownedCurrent && receipt.hashes?.hooksAfter === live.hooks) {
      return {
        ...finish([]), status: 'already_installed', home: root, entries, before, after: before,
        hashes: { hooksBefore: live.hooks, hooksAfter: live.hooks, configBefore: live.config, configAfter: live.config },
        files: publicFiles(before, before), receipt,
      };
    }
    if (ownedCurrent) {
      const refreshedReceipt = {
        ...receipt,
        nodePath,
        cliPath,
        entries,
        hashes: { ...receipt.hashes, hooksAfter: live.hooks, configAfter: live.config },
        nonOwnedHooksSha256: nonOwnedDigest(parsed, entries),
      };
      const after = { hooks: before.hooks, config: before.config, receipt: '[planned]' };
      return {
        ...finish([], { entries: entries.length, receiptRefreshed: true }),
        status: 'planned', home: root, entries, before, after, receipt: refreshedReceipt,
        hashes: refreshedReceipt.hashes,
        files: publicFiles(before, after),
      };
    }
    issues.push(issue('CODEX_HOOK_CONCURRENT_CHANGE', '.codex', 'Live Codex configuration does not match the ContextRail receipt'));
  } else if (counts.some((count) => count.owned > 0)) {
    issues.push(issue('CODEX_HOOK_CONFLICT', HOOKS_PATH, 'ContextRail-like Hook entries exist without a matching receipt'));
  }
  if (issues.length > 0) {
    return { ...finish(issues), status: 'conflict', home: root, files: [], entries, hashes: hashes(before), before };
  }

  const nextHooks = appendEntries(parsed, entries);
  const feature = enableFeature(before.config);
  const after = { hooks: json(nextHooks), config: feature.content, receipt: '[planned]' };
  const planHashes = {
    hooksBefore: contentHash(before.hooks),
    hooksAfter: contentHash(after.hooks),
    configBefore: contentHash(before.config),
    configAfter: contentHash(after.config),
  };
  const receiptData = {
    schema: 1,
    host: 'codex',
    nodePath,
    cliPath,
    entries,
    featureEdit: feature.edit,
    hashes: planHashes,
    nonOwnedHooksSha256: nonOwnedDigest(parsed, entries),
  };
  return {
    ...finish([], { entries: entries.length, featureChanged: feature.edit.type !== 'none' }),
    status: 'planned', home: root, entries, before, after, receipt: receiptData,
    hashes: planHashes,
    files: publicFiles(before, after),
  };
}

async function assertPreconditions(plan, fs) {
  const live = await homeSnapshot(plan.home, fs);
  const expected = hashes(plan.before);
  const actual = hashes(live);
  for (const key of ['hooks', 'config', 'receipt']) {
    if (expected[key] !== actual[key]) throw new Error(`Codex Hook apply refused because of concurrent change in ${key}`);
  }
  return live;
}

async function writeTemporary(path, content, fs, suffix) {
  await fs.mkdir(dirname(path), { recursive: true });
  const temporary = `${path}${suffix}`;
  await fs.writeText(temporary, content);
  return temporary;
}

export async function applyCodexHooksInstall(plan, { fs = nodeFilesystem } = {}) {
  if (!plan.ok) throw new Error('Cannot apply an invalid Codex Hook install plan');
  if (plan.status === 'already_installed') return { status: 'already_installed' };
  await assertPreconditions(plan, fs);
  const suffix = `.tmp-${process.pid}-${Date.now()}`;
  const hooksPath = resolve(plan.home, HOOKS_PATH);
  const configPath = resolve(plan.home, CONFIG_PATH);
  const receiptPath = resolve(plan.home, RECEIPT_PATH);
  const receiptContent = json({ ...plan.receipt, installedAt: new Date().toISOString() });
  const temporaries = [];
  try {
    if (plan.after.hooks !== plan.before.hooks) {
      temporaries.push(await writeTemporary(hooksPath, plan.after.hooks, fs, suffix));
    }
    if (plan.after.config !== plan.before.config && plan.after.config !== null) {
      temporaries.push(await writeTemporary(configPath, plan.after.config, fs, suffix));
    }
    temporaries.push(await writeTemporary(receiptPath, receiptContent, fs, suffix));
    if (plan.after.hooks !== plan.before.hooks) await fs.rename(`${hooksPath}${suffix}`, hooksPath);
    if (plan.after.config !== plan.before.config && plan.after.config !== null) await fs.rename(`${configPath}${suffix}`, configPath);
    await fs.rename(`${receiptPath}${suffix}`, receiptPath);
    return { status: 'installed', files: plan.files };
  } catch (error) {
    await restoreSnapshot(plan.home, plan.before, fs);
    for (const temporary of temporaries) if (await fs.exists(temporary)) await fs.remove(temporary, { force: true });
    throw error;
  }
}

export async function planCodexHooksUninstall({ home, fs = nodeFilesystem }) {
  const root = resolve(home);
  const before = await homeSnapshot(root, fs);
  const issues = [];
  const hooks = parseHooks(before.hooks, issues);
  if (!hooks) return { ...finish(issues), status: 'conflict', home: root, before, files: [] };
  if (before.receipt === null) {
    if (Object.values(hooks.hooks).some((groups) => groups.some(groupHasOwnedHandler))) {
      issues.push(issue('CODEX_HOOK_CONFLICT', HOOKS_PATH, 'ContextRail-like Hook entries exist without a receipt'));
    }
    return { ...finish(issues), status: issues.length ? 'conflict' : 'not_installed', home: root, before, after: before, files: [] };
  }
  let receipt;
  try {
    receipt = JSON.parse(before.receipt);
  } catch (error) {
    issues.push(issue('INVALID_CODEX_HOOK_RECEIPT', RECEIPT_PATH, `Cannot load receipt: ${error.message}`));
    return { ...finish(issues), status: 'conflict', home: root, before, files: [] };
  }
  const live = hashes(before);
  if (receipt.hashes?.hooksAfter !== live.hooks || !receiptConfigCurrent(before.config, receipt)) {
    issues.push(issue('CODEX_HOOK_CONCURRENT_CHANGE', '.codex', 'Live Codex configuration changed after ContextRail installation'));
    return { ...finish(issues), status: 'conflict', home: root, before, files: [], receipt };
  }
  let nextHooks;
  let nextConfig;
  try {
    nextHooks = removeEntries(hooks, receipt.entries ?? []);
    nextConfig = reverseFeature(before.config, receipt.featureEdit);
  } catch (error) {
    issues.push(issue('CODEX_HOOK_UNINSTALL_CONFLICT', '.codex', error.message));
    return { ...finish(issues), status: 'conflict', home: root, before, files: [], receipt };
  }
  const after = { hooks: json(nextHooks), config: nextConfig, receipt: null };
  return {
    ...finish([], { entries: receipt.entries?.length ?? 0 }),
    status: 'planned', home: root, before, after, receipt,
    files: publicFiles(before, after),
  };
}

export async function applyCodexHooksUninstall(plan, { fs = nodeFilesystem } = {}) {
  if (!plan.ok) throw new Error('Cannot apply an invalid Codex Hook uninstall plan');
  if (plan.status === 'not_installed') return { status: 'not_installed' };
  await assertPreconditions(plan, fs);
  const suffix = `.tmp-${process.pid}-${Date.now()}`;
  const hooksPath = resolve(plan.home, HOOKS_PATH);
  const configPath = resolve(plan.home, CONFIG_PATH);
  const receiptPath = resolve(plan.home, RECEIPT_PATH);
  const temporaries = [];
  try {
    temporaries.push(await writeTemporary(hooksPath, plan.after.hooks, fs, suffix));
    if (plan.after.config !== plan.before.config && plan.after.config !== null) {
      temporaries.push(await writeTemporary(configPath, plan.after.config, fs, suffix));
    }
    await fs.rename(`${hooksPath}${suffix}`, hooksPath);
    if (plan.after.config !== plan.before.config && plan.after.config !== null) await fs.rename(`${configPath}${suffix}`, configPath);
    await fs.remove(receiptPath, { force: true });
    return { status: 'uninstalled', files: plan.files };
  } catch (error) {
    await restoreSnapshot(plan.home, plan.before, fs);
    for (const temporary of temporaries) if (await fs.exists(temporary)) await fs.remove(temporary, { force: true });
    throw error;
  }
}

export async function verifyCodexHooks({
  home,
  nodePath,
  cliPath,
  projectAutomation = { enabled: false, projectRoot: null },
  smoke = { route: 'not_run', continue: 'not_run', check: 'not_run' },
  fs = nodeFilesystem,
}) {
  const root = resolve(home);
  const snapshot = await homeSnapshot(root, fs);
  const issues = [];
  const hooks = parseHooks(snapshot.hooks, issues);
  const entries = isAbsolute(nodePath) && isAbsolute(cliPath) ? desiredEntries(nodePath, cliPath) : [];
  const states = {};
  for (const entry of entries) {
    const count = hooks ? entryCounts(hooks, entry) : { exact: 0, owned: 0 };
    states[entry.event === 'Stop' ? 'stop' : 'userPromptSubmit'] = count.exact > 1 || count.owned > 1
      ? 'duplicate'
      : count.exact === 1 && count.owned === 1
        ? 'ready'
        : count.owned === 0 ? 'missing' : 'mismatch';
  }
  let receipt = null;
  if (snapshot.receipt !== null) {
    try {
      receipt = JSON.parse(snapshot.receipt);
    } catch {
      // Reported as a receipt mismatch below.
    }
  }
  const receiptCurrent = Boolean(receipt)
    && receipt.hashes?.hooksAfter === contentHash(snapshot.hooks)
    && receiptConfigCurrent(snapshot.config, receipt);
  const preservation = receipt && hooks && receipt.nonOwnedHooksSha256 === nonOwnedDigest(hooks, receipt.entries ?? [])
    ? 'preserved'
    : receipt ? 'unverified' : 'not_recorded';
  const feature = featureState(snapshot.config).enabled ? 'enabled' : 'disabled';
  const pathState = {
    node: isAbsolute(nodePath) && await fs.exists(nodePath) ? 'ready' : 'missing_or_relative',
    cli: isAbsolute(cliPath) && await fs.exists(cliPath) ? 'ready' : 'missing_or_relative',
  };
  const entryValues = Object.values(states);
  const state = entryValues.some((value) => ['duplicate', 'mismatch'].includes(value)) || (receipt && !receiptCurrent)
    ? 'conflict'
    : entryValues.every((value) => value === 'ready') && feature === 'enabled' && receiptCurrent
      ? 'registered'
      : entryValues.every((value) => value === 'missing') && !receipt
        ? 'not_installed'
        : 'degraded';
  return {
    state,
    entries: states,
    paths: pathState,
    featureFlag: feature,
    receipt: receiptCurrent ? 'current' : receipt ? 'mismatch' : 'absent',
    nonOwnedHooks: preservation,
    projectAutomation,
    smoke,
    contextInjection: 'unverified',
    issues,
  };
}
