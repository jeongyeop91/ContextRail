import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { nodeFilesystem } from '../adapters/filesystem.mjs';
import { normalizeAdoptionConfig, planExistingRepositoryAdoption } from '../core/adoption.mjs';
import { applyProjectAutomation, codexAutomation, planProjectAutomation } from '../core/automation.mjs';
import { buildSetupPlan, classifyProject, normalizeSetupOptions } from '../core/setup.mjs';
import { applyScaffold, planScaffold } from '../core/scaffold.mjs';
import { applyCodexHooksInstall, planCodexHooksInstall, verifyCodexHooks } from './codex-hooks.mjs';
import { applyManagedInstall, planManagedInstall } from './throughline-install.mjs';
import { verifyThroughline } from './throughline-verify.mjs';
import { assertMatchingCodexEnvironment, resolvePackageBin } from '../adapters/platform.mjs';

const RECEIPT_PATH = '.context-rail/runtime/setup-receipt.json';

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function publicProjectPlan(plan) {
  if (!plan) return null;
  return {
    ok: plan.ok,
    mode: plan.mode,
    operations: plan.operations.map(({ action, path, contentHash, reason }) => ({ action, path, contentHash, reason })),
    issues: plan.issues,
  };
}

function sourceManifest(setupManifest) {
  const value = setupManifest.throughline;
  return {
    repository: value.repository,
    baseCommit: value.baseCommit,
    compatibilityCommit: value.compatibilityCommit,
    patch: { sha256: value.patchSha256 },
  };
}

async function projectDiscovery(target, fs) {
  const targetExists = await fs.exists(target);
  const entries = targetExists ? await fs.list(target) : [];
  const configPath = resolve(target, '.context-rail/config.json');
  let configState = 'absent';
  if (await fs.exists(configPath)) {
    try {
      const value = JSON.parse(await fs.readText(configPath));
      configState = value && typeof value === 'object' ? 'valid' : 'invalid';
    } catch {
      configState = 'invalid';
    }
  }
  return { targetExists, entries, project: classifyProject({ entries, configState }) };
}

function planningFilesystem(fs, target, targetExists) {
  return {
    ...fs,
    async mkdir(path, options) {
      if (!targetExists && resolve(path) === target) return undefined;
      return fs.mkdir(path, options);
    },
    async list(path, options) {
      if (!targetExists && resolve(path) === target) return [];
      return fs.list(path, options);
    },
  };
}

async function loadAdoptionConfig(path, fs) {
  const parsed = JSON.parse(await fs.readText(resolve(path)));
  const normalized = normalizeAdoptionConfig(parsed);
  if (!normalized.ok) throw new Error(`Invalid adoption config: ${normalized.issues.map(({ code }) => code).join(', ')}`);
  return normalized.config;
}

export async function planSetup({
  target,
  input = {},
  home,
  managedRoot,
  platform = process.platform,
  env = process.env,
  nodePath = process.execPath,
  cliPath,
  templateRoot,
  setupManifest,
  fs = nodeFilesystem,
}) {
  const normalized = normalizeSetupOptions(input);
  const root = resolve(target);
  if (!normalized.ok) {
    return {
      plan: { schema: 1, status: 'invalid', id: sha256(normalized.issues), profile: null, target: root, platform, project: null, steps: [], issues: normalized.issues, applyRequired: false },
      execution: null,
    };
  }
  assertMatchingCodexEnvironment({ platform, env, codexHome: resolve(home, '.codex') });
  const discovery = await projectDiscovery(root, fs);
  const options = normalized.options;
  let adoptionConfig = null;
  if (options.adoptionConfig) adoptionConfig = await loadAdoptionConfig(options.adoptionConfig, fs);

  let projectPlan = null;
  if (discovery.project.kind === 'new') {
    projectPlan = await planScaffold({ mode: 'init', target: root, templateRoot, fs: planningFilesystem(fs, root, discovery.targetExists) });
  } else if (discovery.project.kind === 'existing' && adoptionConfig) {
    projectPlan = await planExistingRepositoryAdoption({ target: root, config: adoptionConfig, fs });
  }

  const components = [];
  let throughlinePlan = null;
  if (options.profile !== 'core_only') {
    if (options.profile === 'existing_throughline') {
      components.push({ id: 'throughline', action: 'reuse_existing', preconditionHash: sha256('external-throughline-readiness') });
    } else {
      throughlinePlan = planManagedInstall({
        managedRoot,
        artifact: resolve(managedRoot, 'downloads', setupManifest.throughline.artifact.name),
        version: setupManifest.throughline.packageVersion,
        manifest: sourceManifest(setupManifest),
      });
      components.push({
        id: 'throughline',
        action: 'install_managed',
        releaseId: throughlinePlan.releaseId,
        artifact: setupManifest.throughline.artifact,
        preconditionHash: setupManifest.throughline.artifact.sha256,
      });
    }
  }

  const projectAction = discovery.project.kind === 'configured' ? 'verify' : (projectPlan?.mode ?? 'needs_mapping');
  components.push({ id: 'project', action: projectAction, preconditionHash: sha256(publicProjectPlan(projectPlan) ?? discovery.project) });

  let hooksPlan = null;
  if (['full', 'existing_throughline'].includes(options.profile)) {
    hooksPlan = await planCodexHooksInstall({ home, nodePath: resolve(nodePath), cliPath: resolve(cliPath), fs });
    components.push({ id: 'context_hooks', action: 'install', files: hooksPlan.files, preconditionHash: sha256(hooksPlan.hashes) });
    components.push({ id: 'automation', action: 'enable', preconditionHash: sha256('codex-automation-enabled') });
  }
  components.push({ id: 'verify', action: 'aggregate' });

  const plan = buildSetupPlan({
    options,
    discovery: { target: root, project: discovery.project, platform },
    components,
  });
  if (projectPlan && !projectPlan.ok) {
    plan.status = 'conflict';
    plan.applyRequired = false;
    plan.issues = projectPlan.issues;
  }
  if (hooksPlan && !hooksPlan.ok) {
    plan.status = 'conflict';
    plan.applyRequired = false;
    plan.issues = hooksPlan.issues;
  }
  return {
    plan,
    execution: { options, discovery, projectPlan, throughlinePlan, setupManifest },
  };
}

async function writeReceipt({ target, planId, profile, steps, fs }) {
  if (!(await fs.exists(resolve(target, '.context-rail/config.json')))) return;
  const path = resolve(target, RECEIPT_PATH);
  const temporary = `${path}.tmp-${process.pid}`;
  await fs.mkdir(resolve(path, '..'), { recursive: true });
  await fs.writeText(temporary, `${JSON.stringify({ schema: 1, planId, profile, updatedAt: new Date().toISOString(), steps }, null, 2)}\n`);
  await fs.rename(temporary, path);
}

async function managedAlreadySelected(managedRoot, releaseId, fs) {
  try {
    const current = JSON.parse(await fs.readText(resolve(managedRoot, 'current.json')));
    return current.releaseId === releaseId && await fs.exists(resolve(managedRoot, 'releases', releaseId, 'receipt.json'));
  } catch {
    return false;
  }
}

export async function applySetup({ planned, approvedPlanId, dependencies }) {
  if (planned.plan.id !== approvedPlanId) throw new Error('Setup approval does not match the displayed plan identity');
  if (planned.plan.status !== 'planned') throw new Error(`Cannot apply setup in state ${planned.plan.status}`);
  const { fs = nodeFilesystem } = dependencies;
  const steps = planned.plan.steps.map(({ id }) => ({ id, status: 'pending' }));
  const complete = async (id) => {
    steps.find((entry) => entry.id === id).status = 'completed';
    await writeReceipt({ target: planned.plan.target, planId: planned.plan.id, profile: planned.plan.profile, steps, fs });
  };
  let temporary = null;
  try {
    if (planned.plan.steps.some(({ id }) => id === 'throughline')) {
      if (planned.execution.options.profile === 'existing_throughline') {
        const report = await verifyThroughline({ binary: dependencies.existingThroughlineBinary ?? 'throughline', processAdapter: dependencies.processAdapter, env: dependencies.env });
        if (!['hooks_ready', 'capture_verified'].includes(report.state)) throw new Error(`Existing Throughline is not compatible: ${report.state}`);
      } else if (!(await managedAlreadySelected(dependencies.managedRoot, planned.execution.throughlinePlan.releaseId, fs))) {
        temporary = await mkdtemp(resolve(dependencies.tempRoot, 'contextrail-setup-'));
        const destination = resolve(temporary, planned.execution.setupManifest.throughline.artifact.name);
        await dependencies.downloadArtifact({ artifact: planned.execution.setupManifest.throughline.artifact, destination, fs });
        const installPlan = planManagedInstall({
          managedRoot: dependencies.managedRoot,
          artifact: destination,
          version: planned.execution.setupManifest.throughline.packageVersion,
          manifest: sourceManifest(planned.execution.setupManifest),
        });
        await applyManagedInstall({
          plan: installPlan,
          apply: true,
          home: dependencies.home,
          nodePath: dependencies.nodePath,
          fs,
          processAdapter: dependencies.processAdapter,
        });
      }
      await complete('throughline');
    }

    if (planned.execution.projectPlan) await applyScaffold(planned.execution.projectPlan, fs);
    await complete('project');

    if (planned.plan.steps.some(({ id }) => id === 'context_hooks')) {
      const hooksPlan = await planCodexHooksInstall({ home: dependencies.home, nodePath: resolve(dependencies.nodePath), cliPath: resolve(dependencies.cliPath), fs });
      await applyCodexHooksInstall(hooksPlan, { fs });
      await complete('context_hooks');

      const automationPlan = await planProjectAutomation({ target: planned.plan.target, enabled: true, fs });
      await applyProjectAutomation(automationPlan, fs);
      await complete('automation');
    }

    const report = await verifySetup({ ...dependencies, target: planned.plan.target, input: dependencies.input });
    await complete('verify');
    return { status: report.status, planId: planned.plan.id, steps, report };
  } catch (error) {
    const failed = steps.find((entry) => entry.status === 'pending');
    if (failed) failed.status = 'failed';
    await writeReceipt({ target: planned.plan.target, planId: planned.plan.id, profile: planned.plan.profile, steps, fs });
    error.setup = { status: 'failed', planId: planned.plan.id, steps };
    throw error;
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}

export async function verifySetup({
  target,
  input = {},
  home,
  managedRoot,
  nodePath = process.execPath,
  cliPath,
  env,
  fs = nodeFilesystem,
  processAdapter,
  existingThroughlineBinary = 'throughline',
  liveEvidence = null,
  codexSmoke = { route: 'passed', continue: 'passed', check: 'passed' },
}) {
  const normalized = normalizeSetupOptions(input);
  if (!normalized.ok) return { status: 'invalid', issues: normalized.issues };
  const profile = normalized.options.profile;
  const configPath = resolve(target, '.context-rail/config.json');
  let config = null;
  try {
    config = JSON.parse(await fs.readText(configPath));
  } catch {
    // Reported below as not ready.
  }
  const project = { state: config ? 'ready' : 'not_ready' };
  if (profile === 'core_only') {
    return { status: config ? 'installed' : 'degraded', profile, project, throughline: { state: 'not_selected' }, contextHooks: { state: 'not_selected' }, automation: { enabled: false }, live: { throughline: 'not_selected', context: 'not_selected' } };
  }

  let throughline;
  if (profile === 'existing_throughline') {
    throughline = await verifyThroughline({ binary: existingThroughlineBinary, processAdapter, env });
  } else {
    try {
      const current = JSON.parse(await fs.readText(resolve(managedRoot, 'current.json')));
      const releaseRoot = resolve(managedRoot, 'releases', current.releaseId);
      const binPath = await resolvePackageBin({ installRoot: releaseRoot, packageName: 'throughline', fs });
      throughline = await verifyThroughline({ nodePath: resolve(nodePath), binPath, processAdapter, env });
    } catch (error) {
      throughline = { state: 'absent', reasons: ['managed_release_unavailable'], error: error.message };
    }
  }

  let contextHooks = { state: 'not_selected' };
  let automation = { enabled: false };
  if (['full', 'existing_throughline'].includes(profile)) {
    automation = { ...codexAutomation(config), projectRoot: resolve(target) };
    contextHooks = await verifyCodexHooks({ home, nodePath: resolve(nodePath), cliPath: resolve(cliPath), projectAutomation: automation, smoke: codexSmoke, fs });
  }
  const structural = project.state === 'ready'
    && ['hooks_ready', 'capture_verified'].includes(throughline.state)
    && (profile === 'memory_without_context_hooks' || (contextHooks.state === 'registered' && automation.enabled));
  const live = {
    throughline: liveEvidence?.throughline === true ? 'verified' : 'unverified',
    context: profile === 'memory_without_context_hooks' ? 'not_selected' : (liveEvidence?.context === true ? 'verified' : 'unverified'),
  };
  const liveReady = live.throughline === 'verified' && (live.context === 'verified' || live.context === 'not_selected');
  return {
    status: structural ? (liveReady ? 'installed' : 'installed_live_verification_required') : 'degraded',
    profile,
    project,
    throughline,
    contextHooks,
    automation,
    live,
  };
}
