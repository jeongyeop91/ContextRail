import { createHash } from 'node:crypto';

import { issue } from './result.mjs';

const PROJECT_MODES = new Set(['auto', 'new', 'existing']);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

export function normalizeSetupOptions(input = {}) {
  const issues = [];
  const selected = [input.coreOnly, input.noContextHooks, input.useExistingThroughline].filter(Boolean).length;
  if (selected > 1) issues.push(issue('INCOMPATIBLE_SETUP_PROFILE', 'setup', 'Select only one reduced setup profile'));
  const project = input.project ?? 'auto';
  if (!PROJECT_MODES.has(project)) issues.push(issue('INVALID_SETUP_PROJECT_MODE', 'setup', 'project must be auto, new, or existing'));
  if (project === 'new' && input.adoptionConfig) issues.push(issue('UNEXPECTED_SETUP_ADOPTION_CONFIG', 'setup', 'A new project cannot use an adoption config'));
  const profile = input.coreOnly
    ? 'core_only'
    : input.noContextHooks
      ? 'memory_without_context_hooks'
      : input.useExistingThroughline
        ? 'existing_throughline'
        : 'full';
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, issues: [], options: { profile, project, adoptionConfig: input.adoptionConfig ?? null } };
}

export function classifyProject({ entries, configState }) {
  const names = [...new Set(entries)].sort();
  if (configState === 'valid') return { kind: 'configured', candidates: [] };
  const meaningful = names.filter((name) => name !== '.git');
  if (meaningful.length === 0 && configState === 'absent') return { kind: 'new', candidates: [] };
  const candidates = names
    .filter((name) => !['.git', '.context-rail'].includes(name))
    .slice(0, 20);
  return { kind: 'existing', candidates, configState };
}

export function setupPlanId(plan) {
  const publicPlan = canonical({ ...plan, id: undefined });
  return createHash('sha256').update(JSON.stringify(publicPlan)).digest('hex');
}

export function buildSetupPlan({ options, discovery, components }) {
  const needsMapping = discovery.project.kind === 'existing' && !options.adoptionConfig;
  const issues = needsMapping
    ? [issue('SETUP_ADOPTION_CONFIG_REQUIRED', 'setup', 'Existing repositories require a reviewed adoption config')]
    : [];
  const base = {
    schema: 1,
    status: needsMapping ? 'needs_input' : 'planned',
    profile: options.profile,
    target: discovery.target,
    platform: discovery.platform,
    project: structuredClone(discovery.project),
    steps: needsMapping ? [] : structuredClone(components),
    issues,
    applyRequired: !needsMapping,
  };
  return { ...base, id: setupPlanId(base) };
}

