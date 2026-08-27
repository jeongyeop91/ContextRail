import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { appendMeasurement, summarizeMeasurements, validateMeasurement } from '../src/core/measurement.mjs';
import { nodeFilesystem } from '../src/adapters/filesystem.mjs';

function record(source = 'manual', metrics = { inputTokens: 100 }) {
  return {
    schema: 1,
    recordedAt: '2026-08-27T00:00:00.000Z',
    taskId: 'CR-001',
    sessionIdHash: 'a'.repeat(64),
    source,
    metrics,
  };
}

test('accepts all supported provenance sources', () => {
  for (const source of ['host_reported', 'tool_reported', 'manual', 'estimated']) {
    assert.deepEqual(validateMeasurement(record(source)).issues, []);
  }
});

test('rejects negative metrics and raw or secret-bearing fields', () => {
  assert.ok(validateMeasurement(record('manual', { inputTokens: -1 })).issues.some((entry) => entry.code === 'INVALID_METRIC_VALUE'));
  assert.ok(validateMeasurement({ ...record(), prompt: 'raw body' }).issues.some((entry) => entry.code === 'FORBIDDEN_MEASUREMENT_FIELD'));
  assert.ok(validateMeasurement({ ...record(), secret: 'value' }).issues.some((entry) => entry.code === 'FORBIDDEN_MEASUREMENT_FIELD'));
});

test('separates estimated and reported aggregates', () => {
  const report = summarizeMeasurements([
    record('manual', { inputTokens: 100, contextUtilizationRatio: 0.25, handoffs: 1 }),
    record('tool_reported', { inputTokens: 200, contextUtilizationRatio: 0.5, handoffs: 0 }),
    record('estimated', { inputTokens: 1000, contextUtilizationRatio: 0.9, handoffs: 3 }),
  ]);
  assert.equal(report.metrics.inputTokens.reported.total, 300);
  assert.equal(report.metrics.inputTokens.estimated.total, 1000);
  assert.equal(report.metrics.contextUtilizationRatio.reported.average, 0.375);
  assert.equal(report.metrics.handoffs.estimated.average, 3);
});

test('returns an empty report without inventing values', () => {
  assert.deepEqual(summarizeMeasurements([]), { records: 0, metrics: {} });
});

test('appends only validated records beneath the local runtime directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-measure-'));
  const result = await appendMeasurement(root, record(), nodeFilesystem);
  assert.equal(result.ok, true);
  const stored = await readFile(join(root, '.context-rail/runtime/measurements.jsonl'), 'utf8');
  assert.deepEqual(JSON.parse(stored.trim()), record());
  await assert.rejects(() => appendMeasurement(root, record('manual', { outputTokens: -2 }), nodeFilesystem), /Invalid measurement/);
});
