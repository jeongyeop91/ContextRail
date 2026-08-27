import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REQUIRED_PATHS = [
  'AGENTS.md',
  'src/AGENTS.md',
  'test/AGENTS.md',
  'integrations/throughline/AGENTS.md',
  'docs/README.md',
  'docs/authority/PROJECT.md',
  'docs/authority/OPERATING_MODEL.md',
  'docs/authority/DOCUMENT_GOVERNANCE.md',
  'docs/authority/VALIDATION.md',
  'docs/authority/CONTINUITY.md',
  'docs/authority/MEASUREMENT.md',
  'docs/authority/INTEGRATIONS.md',
  'docs/adr/README.md',
  'docs/adr/0001-template-and-local-cli.md',
  'docs/history/README.md',
  'docs/generated/README.md',
  'docs/reference/README.md',
  'state/CURRENT.md',
  'state/BACKLOG.json',
  '.context-rail/config.json',
  '.context-rail/version.json',
  '.gitignore',
  'package.json',
];

function lineCount(path) {
  return readFileSync(path, 'utf8').split(/\r?\n/).length;
}

test('self-hosting foundation exists', () => {
  for (const relative of REQUIRED_PATHS) {
    assert.equal(existsSync(join(ROOT, relative)), true, relative);
  }
});

test('routing index and active authority stay bounded', () => {
  const router = join(ROOT, 'docs/README.md');
  assert.ok(lineCount(router) <= 50, 'docs/README.md exceeds 50 lines');

  const authorityRoot = join(ROOT, 'docs/authority');
  for (const entry of readdirSync(authorityRoot)) {
    if (entry.endsWith('.md')) {
      assert.ok(lineCount(join(authorityRoot, entry)) <= 500, `${entry} exceeds 500 lines`);
    }
  }
});
