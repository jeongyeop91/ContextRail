import { createHash } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { nodeProcess } from '../src/adapters/process.mjs';
import { loadThroughlineManifest } from '../src/integrations/throughline-manifest.mjs';
import { prepareThroughline } from '../src/integrations/throughline-prepare.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT_PATH), '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function defaultPrepare({ root, fs, processAdapter }) {
  const loaded = await loadThroughlineManifest(root, fs);
  if (!loaded.ok) throw new Error(`Throughline manifest invalid: ${loaded.issues.map(({ code }) => code).join(', ')}`);
  return prepareThroughline({ manifest: loaded.manifest, integrationRoot: root, tempParent: tmpdir(), fs, processAdapter });
}

export async function buildThroughlineArtifact({
  root = ROOT,
  output,
  fs = nodeFilesystem,
  processAdapter = nodeProcess,
  prepare = defaultPrepare,
}) {
  const destination = resolve(output);
  if (await fs.exists(destination)) throw new Error(`Throughline output already exists: ${destination}`);
  const result = await prepare({ root, fs, processAdapter });
  if (basename(result.artifact) !== basename(destination)) throw new Error('Prepared Throughline filename differs from requested output');
  const bytes = await fs.readBytes(result.artifact);
  await fs.mkdir(dirname(destination), { recursive: true });
  await fs.writeBytes(destination, bytes);
  return { output: destination, sha256: sha256(bytes), evidence: result.evidence };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SCRIPT_PATH)) {
  const index = process.argv.indexOf('--output');
  const output = index === -1 ? null : process.argv[index + 1];
  if (!output) {
    process.stderr.write('Usage: node scripts/build-throughline.mjs --output FILE\n');
    process.exitCode = 2;
  } else {
    try {
      process.stdout.write(`${JSON.stringify(await buildThroughlineArtifact({ output }), null, 2)}\n`);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

