import { access, appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';

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
  writeText(path, content) {
    return writeFile(path, content, 'utf8');
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
};
