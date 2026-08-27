import { gzipSync, gunzipSync } from 'node:zlib';

export function normalizeGzipBytes(bytes) {
  const normalized = gzipSync(gunzipSync(bytes), { level: 0, mtime: 0 });
  normalized[9] = 255;
  return normalized;
}
