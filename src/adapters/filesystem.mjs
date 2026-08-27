import { access, appendFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';

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
