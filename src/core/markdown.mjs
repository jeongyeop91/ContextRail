export function lineCount(text) {
  if (text.length === 0) return 0;
  return text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length;
}

export function extractLinks(markdown) {
  const links = [];
  const pattern = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of markdown.matchAll(pattern)) links.push(match[1].replace(/^<|>$/g, ''));
  return links;
}

export function headingSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function headingAnchors(markdown) {
  const counts = new Map();
  const anchors = new Set();
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(?: {0,3})#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const base = headingSlug(match[1]);
    const count = counts.get(base) ?? 0;
    anchors.add(count === 0 ? base : `${base}-${count}`);
    counts.set(base, count + 1);
  }
  return anchors;
}

export function splitLink(link) {
  const hash = link.indexOf('#');
  if (hash === -1) return { file: decodeURIComponent(link), anchor: null };
  return {
    file: decodeURIComponent(link.slice(0, hash)),
    anchor: decodeURIComponent(link.slice(hash + 1)).toLowerCase(),
  };
}
