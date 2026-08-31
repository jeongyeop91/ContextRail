# Human CLI and Hook Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver concise `setup`, `doctor`, and `handoff` commands while recording enough privacy-safe evidence to distinguish Codex Stop dispatch from Throughline capture.

**Architecture:** CLI presentation stays pure and consumes structured results. ContextRail's owned Stop handler writes one project-local diagnostic marker after its read-only validation, managed Throughline remains an external argv adapter, and Codex feature migration stays inside the existing receipt-guarded plan/apply transaction.

**Tech Stack:** Node.js 22.13+, `node:test`, standard-library filesystem/process APIs, TOML-preserving line transforms, existing ContextRail integration adapters.

**Spec:** `docs/superpowers/specs/2026-08-31-human-cli-and-handoff-design.md`

## Global Constraints

- Core operation must not require Throughline, a network, or a global package.
- Write-capable setup remains plan-first and requires the existing explicit or interactive apply boundary.
- `--json` emits one machine-readable document; `--debug` emits human output plus redacted evidence; the flags are mutually exclusive.
- No prompt, response, tool payload, credential, token-shaped value, or personal path is written to the Hook marker.
- ContextRail never reads or writes the Throughline database directly.
- macOS, Windows, and Linux use direct executable/argv process boundaries.

---

### Task 1: Record a bounded ContextRail Stop dispatch marker

**Files:**
- Create: `src/integrations/codex-hook-diagnostics.mjs`
- Modify: `src/cli/main.mjs`
- Create: `test/codex-hook-diagnostics.test.mjs`
- Modify: `test/codex-hooks-cli.test.mjs`

**Interfaces:**
- Consumes: Hook payload fields `session_id`, `cwd`, and the structured result from `handleStop`.
- Produces: `recordCodexHookEvent({ projectRoot, payload, result, fs, now })` and `readCodexHookEvent({ target, fs })`.

- [ ] **Step 1: Write the failing marker behavior tests**

```js
test('Stop records one privacy-safe latest dispatch marker', async () => {
  const marker = await readCodexHookEvent({ target, fs: nodeFilesystem });
  assert.equal(marker.event, 'Stop');
  assert.match(marker.sessionIdHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(marker).includes('3973'), false);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test test/codex-hook-diagnostics.test.mjs test/codex-hooks-cli.test.mjs`

Expected: FAIL because the diagnostics module and marker side effect do not exist.

- [ ] **Step 3: Implement the marker with atomic overwrite**

```js
export async function recordCodexHookEvent({ projectRoot, payload, result, fs, now = () => new Date() }) {
  const marker = {
    schema: 1,
    event: 'Stop',
    observedAt: now().toISOString(),
    sessionIdHash: sha256(String(payload.session_id ?? 'unavailable')),
    projectMatched: true,
    status: result.status,
  };
  await fs.writeText(path, `${JSON.stringify(marker, null, 2)}\n`);
  return marker;
}
```

The real implementation uses a sibling temporary plus rename and silently preserves Hook fail-open behavior if the marker cannot be written.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `node --test test/codex-hook-diagnostics.test.mjs test/codex-hooks-cli.test.mjs`

Expected: PASS with prompt/assistant text absent from the marker.

### Task 2: Migrate deprecated Codex feature configuration transactionally

**Files:**
- Modify: `src/integrations/codex-hooks.mjs`
- Modify: `test/codex-hooks.test.mjs`
- Modify: `test/setup-integration.test.mjs`

**Interfaces:**
- Consumes: existing `.codex/config.toml`, Hook receipt, and install/uninstall intent.
- Produces: a migration-aware `featureEdit` receipt that removes `codex_hooks`, preserves canonical `hooks`, and can distinguish migration from an owned enable edit.

- [ ] **Step 1: Add failing literal-fixture migration tests**

```js
test('install migrates legacy codex_hooks while preserving trust state and comments', async () => {
  await writeFile(configPath, '[features]\ncodex_hooks = true # legacy\n\n[hooks.state.\'trusted\']\ntrusted = true\n');
  const plan = await planCodexHooksInstall(scope);
  assert.equal(plan.after.config.includes('codex_hooks'), false);
  assert.equal(plan.after.config.includes('hooks = true'), true);
  assert.equal(plan.after.config.includes("[hooks.state.'trusted']"), true);
});
```

Cover legacy true, legacy false install, dual key, repeat setup, uninstall canonical preservation, and concurrent user edits.

- [ ] **Step 2: Run the migration tests and verify RED**

Run: `node --test test/codex-hooks.test.mjs test/setup-integration.test.mjs`

Expected: FAIL because the current `enableFeature` leaves `codex_hooks` in place.

- [ ] **Step 3: Implement a line-preserving migration edit**

Represent receipt state as separate `migrationEdit` and `featureEdit` fields. Remove only recognized boolean `codex_hooks` lines inside `[features]`, let canonical `hooks` win when present, and preserve all unrelated bytes and trust sections.

- [ ] **Step 4: Run the migration tests and verify GREEN**

Run: `node --test test/codex-hooks.test.mjs test/setup-integration.test.mjs`

Expected: PASS, including repeat setup after Codex trust-state persistence.

### Task 3: Add pure human and debug renderers plus top-level doctor

**Files:**
- Create: `src/cli/presentation.mjs`
- Create: `src/integrations/doctor.mjs`
- Modify: `src/cli/main.mjs`
- Create: `test/presentation.test.mjs`
- Create: `test/doctor.test.mjs`
- Modify: `test/setup-cli.test.mjs`

**Interfaces:**
- Consumes: setup plan/result, `verifySetup`, ContextRail Hook marker, and optional raw Throughline doctor evidence.
- Produces: `renderSetupHuman`, `renderDoctorHuman`, `renderHandoffHuman`, `renderDebugEvidence`, and `buildDoctorReport`.

- [ ] **Step 1: Add failing concise-output and redaction tests**

```js
test('doctor human output is concise and debug output redacts sensitive evidence', () => {
  assert.equal(renderDoctorHuman(readyReport).split('\n').length <= 8, true);
  assert.doesNotMatch(renderDebugEvidence(debugFixture), /npm_[A-Za-z0-9]+|refresh_token/);
});
```

Also assert `--debug --json` exits `2`, default setup output contains no plan hash or artifact URL, and JSON setup output stays compatible.

- [ ] **Step 2: Run CLI presentation tests and verify RED**

Run: `node --test test/presentation.test.mjs test/doctor.test.mjs test/setup-cli.test.mjs`

Expected: FAIL because the renderer, doctor command, and debug mode do not exist.

- [ ] **Step 3: Implement structured doctor aggregation and mode selection**

Human mode prints readiness plus one next action. Debug mode appends labelled, redacted JSON evidence. JSON mode emits the versioned structured report only. Throughline unavailability degrades the integration without breaking Core doctor output.

- [ ] **Step 4: Run CLI presentation tests and verify GREEN**

Run: `node --test test/presentation.test.mjs test/doctor.test.mjs test/setup-cli.test.mjs`

Expected: PASS with no raw nested dump in human mode.

### Task 4: Add one-command managed handoff

**Files:**
- Create: `src/integrations/throughline-handoff.mjs`
- Modify: `src/cli/main.mjs`
- Create: `test/throughline-handoff.test.mjs`
- Modify: `test/cli.test.mjs`

**Interfaces:**
- Consumes: `resolveManagedThroughline`, `runThroughlineCommand`, optional `--session`, and `--open-host`.
- Produces: `runManagedHandoff({ managedRoot, nodePath, sessionId, openHost, processAdapter, env, fs })` returning `contextrail.handoff.v1`.

- [ ] **Step 1: Add failing argv and result-mapping tests**

```js
test('handoff invokes selected managed Throughline once with execution enabled', async () => {
  assert.deepEqual(call.args.slice(1), ['codex-handoff-start', '--execute', '--open-host', 'desktop', '--json']);
  assert.equal(result.newTask.id, 'thread-new');
  assert.equal(result.memory.injected, true);
});
```

Cover explicit session forwarding, open failure/manual resume, missing memory, invalid upstream JSON, and normal-output suppression.

- [ ] **Step 2: Run handoff tests and verify RED**

Run: `node --test test/throughline-handoff.test.mjs test/cli.test.mjs`

Expected: FAIL because `contextrail handoff` is not registered.

- [ ] **Step 3: Implement the managed argv adapter and CLI command**

Always request upstream `--json`; never infer a session from SQLite or rollout files. Map only source session, task ID, injection, open result, and manual resume command. Keep raw upstream stdout/stderr only in debug evidence.

- [ ] **Step 4: Run handoff tests and verify GREEN**

Run: `node --test test/throughline-handoff.test.mjs test/cli.test.mjs`

Expected: PASS on POSIX and synthetic Windows paths.

### Task 5: Document and verify the release candidate behavior

**Files:**
- Modify: `README.md`
- Modify: `docs/authority/ARCHITECTURE.md`
- Modify: `docs/authority/INTEGRATIONS.md`
- Modify: `docs/authority/VALIDATION.md`
- Modify: `state/CURRENT.md`
- Modify: `state/PLAN.md`
- Modify: `test/readme-install.test.mjs`

**Interfaces:**
- Consumes: completed command contracts from Tasks 1-4.
- Produces: cross-platform human quickstart, debug recovery instructions, and Windows acceptance steps.

- [ ] **Step 1: Add failing README behavior assertions**

Run: `node --test test/readme-install.test.mjs`

Expected: FAIL until README includes `contextrail doctor`, `contextrail doctor --debug`, and `contextrail handoff --open-host desktop` while keeping machine apply examples.

- [ ] **Step 2: Update authority, README, and live state**

Document the single latest-event marker, the distinction between dispatch and capture, concise default output, and the native Windows rerun sequence.

- [ ] **Step 3: Run targeted and complete verification**

Run: `node --test test/codex-hook-diagnostics.test.mjs test/codex-hooks.test.mjs test/setup-integration.test.mjs test/presentation.test.mjs test/doctor.test.mjs test/throughline-handoff.test.mjs test/setup-cli.test.mjs test/cli.test.mjs test/readme-install.test.mjs`

Run: `npm test`

Run: `npm run verify`

Expected: all tests pass, repository check passes, template smoke passes, and `git diff --check` is clean.
