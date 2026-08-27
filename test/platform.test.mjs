import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { nodeFilesystem } from '../src/adapters/filesystem.mjs';
import { managedDataRoot, nodeBinCommand, resolvePackageBin } from '../src/adapters/platform.mjs';

test('selects native ContextRail data roots on macOS, Linux, and Windows', () => {
  assert.equal(managedDataRoot({ platform: 'darwin', home: '/Users/example', env: {} }), '/Users/example/Library/Application Support/ContextRail');
  assert.equal(managedDataRoot({ platform: 'linux', home: '/home/example', env: { XDG_DATA_HOME: '/data/사용자' } }), '/data/사용자/contextrail');
  assert.equal(managedDataRoot({ platform: 'linux', home: '/home/example', env: {} }), '/home/example/.local/share/contextrail');
  assert.equal(managedDataRoot({ platform: 'win32', home: 'C:\\Users\\Example', env: { LOCALAPPDATA: 'C:\\Users\\Example\\AppData\\Local' } }), 'C:\\Users\\Example\\AppData\\Local\\ContextRail');
  assert.throws(() => managedDataRoot({ platform: 'aix', home: '/home/example', env: {} }), /Unsupported platform/);
  assert.throws(() => managedDataRoot({ platform: 'win32', home: 'C:\\Users\\Example', env: {} }), /LOCALAPPDATA/);
});

test('resolves a package JavaScript bin inside its installed package', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contextrail-bin-resolution-'));
  const packageRoot = join(root, 'node_modules', 'throughline');
  await mkdir(join(packageRoot, 'bin'), { recursive: true });
  await writeFile(join(packageRoot, 'package.json'), JSON.stringify({ name: 'throughline', bin: { throughline: 'bin/cli.mjs' } }));
  await writeFile(join(packageRoot, 'bin/cli.mjs'), 'export {};');
  assert.equal(await resolvePackageBin({ installRoot: root, packageName: 'throughline', fs: nodeFilesystem }), join(packageRoot, 'bin/cli.mjs'));

  await writeFile(join(packageRoot, 'package.json'), JSON.stringify({ name: 'throughline', bin: '../../../escape.mjs' }));
  await assert.rejects(resolvePackageBin({ installRoot: root, packageName: 'throughline', fs: nodeFilesystem }), /escapes package root/);
});

test('builds direct Node argv without a shell shim', () => {
  assert.deepEqual(nodeBinCommand({ nodePath: '/runtime/node', binPath: '/package/bin/cli.mjs', args: ['install'] }), {
    executable: '/runtime/node',
    args: ['/package/bin/cli.mjs', 'install'],
  });
  assert.throws(() => nodeBinCommand({ nodePath: 'node', binPath: '/package/bin/cli.mjs' }), /absolute/);
});
