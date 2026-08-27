import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import test from 'node:test';

import { normalizeGzipBytes } from '../scripts/archive.mjs';

test('normalizes different gzip streams to one platform-independent artifact', () => {
  const tarBytes = Buffer.from('same deterministic tar payload'.repeat(4096));
  const fast = gzipSync(tarBytes, { level: 1 });
  const compact = gzipSync(tarBytes, { level: 9 });

  const normalizedFast = normalizeGzipBytes(fast);
  const normalizedCompact = normalizeGzipBytes(compact);

  assert.deepEqual(normalizedFast, normalizedCompact);
  assert.deepEqual(gunzipSync(normalizedFast), tarBytes);
  assert.deepEqual([...normalizedFast.subarray(4, 8)], [0, 0, 0, 0]);
  assert.equal(normalizedFast[9], 255);
});
