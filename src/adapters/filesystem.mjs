import { access, appendFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';

const RETRYABLE_RENAME_CODES = new Set(['EACCES', 'EBUSY', 'EPERM']);

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function renameWithRetry(fs, from, to, { attempts = 8, retryDelayMs = 25 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fs.rename(from, to);
    } catch (error) {
      if (!RETRYABLE_RENAME_CODES.has(error.code) || attempt === attempts - 1) throw error;
      await wait(retryDelayMs * (attempt + 1));
    }
  }
}

export const nodeFilesystem = {
  async exists(path) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  },
  readText(path) {
    return readFile(path, 'utf8');
  },
  readBytes(path) {
    return readFile(path);
  },
  writeText(path, content) {
    return writeFile(path, content, 'utf8');
  },
  writeBytes(path, content) {
    return writeFile(path, content);
  },
  appendText(path, content) {
    return appendFile(path, content, 'utf8');
  },
  mkdir(path, options = { recursive: true }) {
    return mkdir(path, options);
  },
  list(path, options = {}) {
    return readdir(path, options);
  },
  stat(path) {
    return stat(path);
  },
  rename(from, to) {
    return rename(from, to);
  },
  remove(path, options = {}) {
    return rm(path, options);
  },
};
