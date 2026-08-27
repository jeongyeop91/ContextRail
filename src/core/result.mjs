export function issue(code, path, message, severity = 'error') {
  return { code, path, message, severity };
}

export function finish(issues, summary = {}) {
  const sorted = [...issues].sort((left, right) =>
    left.path.localeCompare(right.path) || left.code.localeCompare(right.code) || left.message.localeCompare(right.message),
  );
  return { ok: sorted.every((entry) => entry.severity !== 'error'), issues: sorted, summary };
}
