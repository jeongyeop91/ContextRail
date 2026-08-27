import { resolve } from 'node:path';

import { finish, issue } from './result.mjs';

export const MEASUREMENT_SOURCES = new Set(['host_reported', 'tool_reported', 'manual', 'estimated']);
export const METRIC_NAMES = new Set([
  'inputTokens',
  'outputTokens',
  'contextWindowTokens',
  'contextUtilizationRatio',
  'turns',
  'sessions',
  'handoffs',
  'repeatedExplanations',
  'filesRead',
  'documentLines',
  'documentBytes',
  'instructionBytes',
  'routedBytes',
  'focusedValidations',
  'fullValidations',
  'validationFailures',
  'reworkCount',
  'durationMs',
]);
const RECORD_FIELDS = new Set(['schema', 'recordedAt', 'taskId', 'sessionIdHash', 'source', 'metrics']);

export function validateMeasurement(record) {
  const issues = [];
  for (const key of Object.keys(record ?? {})) {
    if (!RECORD_FIELDS.has(key)) issues.push(issue('FORBIDDEN_MEASUREMENT_FIELD', key, `Measurement field is not allowed: ${key}`));
  }
  if (record?.schema !== 1) issues.push(issue('INVALID_MEASUREMENT_SCHEMA', 'schema', 'Measurement schema must be 1'));
  if (!MEASUREMENT_SOURCES.has(record?.source)) issues.push(issue('INVALID_MEASUREMENT_SOURCE', 'source', `Unsupported provenance: ${record?.source}`));
  if (typeof record?.taskId !== 'string' || record.taskId.length === 0) issues.push(issue('INVALID_MEASUREMENT_TASK', 'taskId', 'taskId is required'));
  if (!/^[a-f\d]{64}$/i.test(record?.sessionIdHash ?? '')) issues.push(issue('INVALID_SESSION_HASH', 'sessionIdHash', 'sessionIdHash must be a SHA-256 hex digest'));
  if (Number.isNaN(Date.parse(record?.recordedAt))) issues.push(issue('INVALID_RECORDED_AT', 'recordedAt', 'recordedAt must be an ISO timestamp'));
  if (!record?.metrics || typeof record.metrics !== 'object' || Array.isArray(record.metrics)) {
    issues.push(issue('INVALID_METRICS', 'metrics', 'metrics must be an object'));
  } else {
    for (const [name, value] of Object.entries(record.metrics)) {
      if (!METRIC_NAMES.has(name)) issues.push(issue('UNKNOWN_METRIC', `metrics.${name}`, `Unsupported metric: ${name}`));
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (name.endsWith('Ratio') && value > 1)) {
        issues.push(issue('INVALID_METRIC_VALUE', `metrics.${name}`, `Metric must be a non-negative finite number${name.endsWith('Ratio') ? ' no greater than 1' : ''}`));
      }
    }
  }
  return finish(issues, { metricCount: Object.keys(record?.metrics ?? {}).length });
}

function stats(values) {
  if (values.length === 0) return { count: 0, total: 0, average: null, min: null, max: null };
  const total = values.reduce((sum, value) => sum + value, 0);
  return { count: values.length, total, average: total / values.length, min: Math.min(...values), max: Math.max(...values) };
}

export function summarizeMeasurements(records) {
  if (records.length === 0) return { records: 0, metrics: {} };
  const values = new Map();
  for (const record of records) {
    for (const [name, value] of Object.entries(record.metrics)) {
      if (!values.has(name)) values.set(name, new Map());
      const bySource = values.get(name);
      if (!bySource.has(record.source)) bySource.set(record.source, []);
      bySource.get(record.source).push(value);
    }
  }
  const metrics = {};
  for (const [name, bySource] of [...values.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const sources = Object.fromEntries([...bySource.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([source, entries]) => [source, stats(entries)]));
    const reportedValues = [...bySource.entries()].filter(([source]) => source !== 'estimated').flatMap(([, entries]) => entries);
    metrics[name] = { reported: stats(reportedValues), estimated: stats(bySource.get('estimated') ?? []), sources };
  }
  return { records: records.length, metrics };
}

export async function appendMeasurement(root, record, fs) {
  const validation = validateMeasurement(record);
  if (!validation.ok) throw new Error(`Invalid measurement: ${validation.issues.map((entry) => entry.code).join(', ')}`);
  const directory = resolve(root, '.context-rail/runtime');
  await fs.mkdir(directory, { recursive: true });
  await fs.appendText(resolve(directory, 'measurements.jsonl'), `${JSON.stringify(record)}\n`);
  return { ok: true, path: '.context-rail/runtime/measurements.jsonl' };
}

export async function readMeasurements(root, fs) {
  const path = resolve(root, '.context-rail/runtime/measurements.jsonl');
  if (!(await fs.exists(path))) return [];
  const text = await fs.readText(path);
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
