import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';

import { extractLinks, headingAnchors, lineCount, splitLink } from './markdown.mjs';
import { finish, issue } from './result.mjs';

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function repositoryPath(root, path) {
  return normalize(relative(root, path)).split(sep).join('/');
}

async function markdownFiles(fs, directory) {
  if (!(await fs.exists(directory))) return [];
  const entries = await fs.list(directory, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md')).map((entry) => join(directory, entry.name));
}

async function validateLinks(root, paths, fs, issues) {
  for (const source of paths) {
    const markdown = await fs.readText(source);
    for (const rawLink of extractLinks(markdown)) {
      if (/^[a-z][a-z\d+.-]*:/i.test(rawLink) || rawLink.startsWith('//')) continue;
      const { file, anchor } = splitLink(rawLink);
      const target = file ? resolve(dirname(source), file) : source;
      const sourcePath = repositoryPath(root, source);
      if (!inside(root, target)) {
        issues.push(issue('PATH_ESCAPES_ROOT', sourcePath, `Link escapes repository root: ${rawLink}`));
        continue;
      }
      if (!(await fs.exists(target))) {
        issues.push(issue('BROKEN_FILE_LINK', sourcePath, `Linked file does not exist: ${rawLink}`));
        continue;
      }
      if (anchor) {
        const targetText = await fs.readText(target);
        if (!headingAnchors(targetText).has(anchor)) {
          issues.push(issue('BROKEN_ANCHOR', sourcePath, `Heading anchor does not exist: ${rawLink}`));
        }
      }
    }
  }
}

export async function validateDocuments(root, config, fs) {
  const issues = [];
  const router = resolve(root, config.documentRouter);
  const authorityRoot = resolve(root, config.authorityDirectory);
  const authorities = await markdownFiles(fs, authorityRoot);

  if (!(await fs.exists(router))) {
    issues.push(issue('MISSING_ROUTER', config.documentRouter, 'Document router does not exist'));
  }
  if (!(await fs.exists(authorityRoot))) {
    issues.push(issue('MISSING_AUTHORITY_DIRECTORY', config.authorityDirectory, 'Authority directory does not exist'));
  }

  let routerText = '';
  if (await fs.exists(router)) {
    routerText = await fs.readText(router);
    if (lineCount(routerText) > config.limits.routerLines) {
      issues.push(issue('ROUTER_TOO_LARGE', config.documentRouter, `Router exceeds ${config.limits.routerLines} lines`));
    }
  }

  const indexed = new Set(
    extractLinks(routerText)
      .map((link) => splitLink(link).file)
      .filter(Boolean)
      .map((file) => repositoryPath(root, resolve(dirname(router), file))),
  );

  for (const authority of authorities) {
    const path = repositoryPath(root, authority);
    const text = await fs.readText(authority);
    if (lineCount(text) > config.limits.authorityLines) {
      issues.push(issue('AUTHORITY_TOO_LARGE', path, `Authority exceeds ${config.limits.authorityLines} lines`));
    }
    if (!indexed.has(path)) issues.push(issue('UNINDEXED_AUTHORITY', path, 'Authority document is not linked from the router'));
  }

  await validateLinks(root, [...(await fs.exists(router) ? [router] : []), ...authorities], fs, issues);
  return finish(issues, { authorityFiles: authorities.length, routerLines: lineCount(routerText) });
}
