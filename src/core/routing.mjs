import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import { nodeFilesystem } from '../adapters/filesystem.mjs';
import { extractLinks, splitLink } from './markdown.mjs';
import { parseCurrentItem } from './state.mjs';

function relativePath(root, path) {
  return relative(root, path).split(sep).join('/') || '.';
}

function ensureInside(root, path) {
  const rel = relative(root, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('Target is outside repository root');
}

export async function loadConfig(root, fs = nodeFilesystem, configPath = '.context-rail/config.json') {
  return JSON.parse(await fs.readText(resolve(root, configPath)));
}

export async function buildRoute(root, target, options = {}) {
  const fs = options.fs ?? nodeFilesystem;
  const config = options.config ?? await loadConfig(root, fs, options.configPath);
  const targetPath = resolve(root, target);
  ensureInside(root, targetPath);
  let targetDirectory = targetPath;
  if (await fs.exists(targetPath)) {
    const stats = await fs.stat(targetPath);
    if (stats.isFile()) targetDirectory = dirname(targetPath);
  } else {
    targetDirectory = dirname(targetPath);
  }

  const directories = [];
  let cursor = targetDirectory;
  while (true) {
    directories.push(cursor);
    if (cursor === resolve(root)) break;
    cursor = dirname(cursor);
    ensureInside(root, cursor);
  }
  directories.reverse();

  const instructionFiles = [];
  let instructionBytes = 0;
  for (const directory of directories) {
    const candidate = resolve(directory, config.instructionsFile ?? 'AGENTS.md');
    if (await fs.exists(candidate)) {
      const content = await fs.readText(candidate);
      if (content.trim()) {
        instructionFiles.push(relativePath(root, candidate));
        instructionBytes += Buffer.byteLength(content);
      }
    }
  }

  const router = resolve(root, config.documentRouter);
  const routerText = await fs.readText(router);
  const routerDocuments = [relativePath(root, router)];
  for (const raw of extractLinks(routerText)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(raw)) continue;
    const file = splitLink(raw).file;
    if (!file) continue;
    const document = resolve(dirname(router), file);
    ensureInside(root, document);
    const path = relativePath(root, document);
    if (!routerDocuments.includes(path)) routerDocuments.push(path);
  }

  const currentText = await fs.readText(resolve(root, config.state.current));
  const backlog = JSON.parse(await fs.readText(resolve(root, config.state.backlog)));
  const activeId = parseCurrentItem(currentText);
  const currentItem = backlog.items.find((entry) => entry.id === activeId) ?? null;
  return {
    target: relativePath(root, targetPath),
    instructionFiles,
    instructionBytes,
    routerDocuments,
    currentItem,
    validation: currentItem?.validation ?? [],
  };
}
