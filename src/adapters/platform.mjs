import { isAbsolute, relative, resolve, sep, posix, win32 } from 'node:path';

import { nodeFilesystem } from './filesystem.mjs';

export function managedDataRoot({ platform = process.platform, home, env = process.env }) {
  if (platform === 'darwin') return posix.join(home, 'Library/Application Support/ContextRail');
  if (platform === 'linux') return posix.join(env.XDG_DATA_HOME || posix.join(home, '.local/share'), 'contextrail');
  if (platform === 'win32') {
    if (!env.LOCALAPPDATA) throw new Error('LOCALAPPDATA is required for native Windows setup');
    return win32.join(env.LOCALAPPDATA, 'ContextRail');
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

function inside(root, path) {
  const value = relative(root, path);
  return value === '' || (value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value));
}

export async function resolvePackageBin({ installRoot, packageName, fs = nodeFilesystem }) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(packageName)) throw new Error('Package name is invalid');
  const packageRoot = resolve(installRoot, 'node_modules', packageName);
  const metadata = JSON.parse(await fs.readText(resolve(packageRoot, 'package.json')));
  if (metadata.name !== packageName) throw new Error(`Installed package identity mismatch: ${metadata.name ?? 'missing'}`);
  const relativeBin = typeof metadata.bin === 'string' ? metadata.bin : metadata.bin?.[packageName];
  if (typeof relativeBin !== 'string' || relativeBin.length === 0) throw new Error(`Package ${packageName} has no JavaScript bin`);
  const binPath = resolve(packageRoot, relativeBin);
  if (!inside(packageRoot, binPath)) throw new Error(`Package bin escapes package root: ${relativeBin}`);
  if (!(await fs.exists(binPath))) throw new Error(`Package bin does not exist: ${relativeBin}`);
  return binPath;
}

export function nodeBinCommand({ nodePath, binPath, args = [] }) {
  if (!isAbsolute(nodePath) || !isAbsolute(binPath)) throw new Error('Node and package bin paths must be absolute');
  return { executable: nodePath, args: [binPath, ...args] };
}

