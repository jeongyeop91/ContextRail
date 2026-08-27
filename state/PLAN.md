# Codex Context Automation Hooks Implementation Plan

> **For agentic workers:** Execute inline on the current `main` worktree. Do not create branches, worktrees, or subagents. Track every step with this checklist and preserve user Hook configuration.

**Goal:** Add safe, opt-in Codex `UserPromptSubmit` and `Stop` automation, release it as ContextRail v0.2.0, and leave the real user HOME unchanged except for read-only diagnostics.

**Architecture:** A project automation core owns config/hash transitions, a Codex runtime adapter converts documented Hook payloads into bounded ContextRail projections, and a Codex installer merges exact handlers with receipt-guarded uninstall. The CLI supplies explicit dry-run/apply boundaries and dependency injection for temporary-HOME tests.

**Tech Stack:** Node.js 22.13+, ECMAScript modules, Node standard library, `node:test`, JSON, TOML-preserving text edits, Git, npm, GitHub Releases.

**Spec:** `docs/adr/0002-codex-context-automation-hooks.md`

## Global constraints

- Core commands remain offline and dependency-free.
- Hook payloads use only documented Codex fields: `cwd`, `prompt`, `hook_event_name`, `stop_hook_active`, and common metadata when needed.
- `UserPromptSubmit` returns `hookSpecificOutput.additionalContext`; `Stop` returns JSON and never requests continuation.
- Hook commands use absolute Node and CLI paths, numeric timeout seconds, and default synchronous execution.
- Tests use temporary HOME and synthetic repositories; real HOME checks are read-only.
- Throughline packages, hooks, skills, configuration, and source remain unchanged.
- No validation hint, Git command, measurement, transcript read, or prompt persistence occurs in a runtime hook.

---

### Task 1: Project automation ownership transition

**Files:** Create `src/core/automation.mjs` and `test/automation.test.mjs`; modify `src/core/adoption.mjs` and `templates/project/.context-rail/config.json`.

**Interfaces:** `codexAutomation(config)` returns `{enabled,promptRouting,stopCheck}`. `planProjectAutomation({target,enabled,fs})` returns a guarded operation plan. `applyProjectAutomation(plan,fs)` rechecks preconditions and applies or restores both files.

- [x] Write tests that make missing automation default to all false and normalize an explicit valid object.
- [x] Run `node --test test/automation.test.mjs` and observe failure because the module is absent.
- [x] Implement the defaulting and validation helpers without filesystem writes.
- [x] Write tests for enable, disable, dry-run non-mutation, config ownership mismatch, version concurrent change, and atomic rollback.
- [x] Implement hash-guarded plan/apply using sibling temporary files and restore snapshots on a failed transition.
- [x] Preserve the optional automation object in existing-repository config normalization and add an explicit disabled default to the neutral template.
- [x] Run `node --test test/automation.test.mjs test/adoption.test.mjs test/scaffold.test.mjs` and observe all pass.

### Task 2: Codex Hook runtime

**Files:** Create `src/integrations/codex-hook-runtime.mjs` and `test/codex-hook-runtime.test.mjs`; modify `src/core/routing.mjs`.

**Interfaces:** `findContextRailRoot(cwd,fs)` returns a root or null. `handleUserPromptSubmit(payload,{fs})` and `handleStop(payload,{fs})` return output, status, and project root. UserPrompt no-op output is empty; other output is one Codex-compatible JSON line.

- [x] Write failing tests for non-project and disabled-project no-op behavior.
- [x] Write failing tests for route, English continuation, Korean `계속해`, and bounded output without raw prompt content.
- [x] Run `node --test test/codex-hook-runtime.test.mjs` and confirm failures are caused by the absent runtime.
- [x] Implement upward config discovery, validated opt-in checks, continuation intent classification, route/continue projection, and bounded JSON context.
- [x] Write failing Stop tests for inactive no-op, passing check, and concise violation output.
- [x] Implement Stop with the existing read-only validator, `{}` on success/no-op, and `systemMessage` containing only stable code, path, and count on failure.
- [x] Run `node --test test/codex-hook-runtime.test.mjs test/routing.test.mjs test/continuity.test.mjs test/documents.test.mjs test/state.test.mjs` and observe all pass.

### Task 3: Codex Hook installation lifecycle

**Files:** Create `src/integrations/codex-hooks.mjs` and `test/codex-hooks.test.mjs`.

**Interfaces:** `planCodexHooksInstall`, `applyCodexHooksInstall`, `planCodexHooksUninstall`, `applyCodexHooksUninstall`, and `verifyCodexHooks` accept explicit HOME, paths, and filesystem dependencies and return structured results.

- [x] Write failing tests using a temporary HOME fixture with existing Throughline and unrelated Hook groups.
- [x] Cover exact absolute commands, numeric timeouts, preservation, installation idempotency, duplicate detection, and feature flag planning.
- [x] Run `node --test test/codex-hooks.test.mjs` and confirm failure because the installer is absent.
- [x] Implement JSON merge and TOML feature edits while retaining byte-for-byte unrelated content and order.
- [x] Write failing uninstall tests for exact owned-entry removal, feature restoration, missing receipt, and concurrent hash conflict.
- [x] Implement receipt-last transactional apply, rollback on write failure, and receipt/hash-guarded uninstall.
- [x] Add verification for exact paths, duplicate entries, feature state, preserved non-owned entries, receipt state, and separate project automation state.
- [x] Run `node --test test/codex-hooks.test.mjs test/throughline-install.test.mjs` and observe all pass.

### Task 4: CLI commands and synthetic verification smoke

**Files:** Modify `src/cli/main.mjs` and `test/cli.test.mjs`; create `test/codex-hooks-cli.test.mjs`.

**Interfaces:** Add the approved `hooks`, `automation`, and internal `hook` command families, with injected HOME, Node path, CLI path, stdin payload, filesystem, and smoke dependencies.

- [x] Write failing CLI tests for argument validation, plan-first defaults, explicit apply, and internal Hook stdin dispatch.
- [x] Run `node --test test/codex-hooks-cli.test.mjs test/cli.test.mjs` and observe the new commands fail with usage code 2.
- [x] Add CLI parsing and structured output without changing existing command behavior.
- [x] Implement verify smoke in a temporary project: create neutral scaffold, enable automation, run route, continuation, passing Stop, and failing Stop payloads, then remove the fixture.
- [x] Ensure internal Hook errors return exit 0 with concise non-blocking JSON and never echo the original prompt.
- [x] Run `node --test test/codex-hooks-cli.test.mjs test/cli.test.mjs` and observe all pass.

### Task 5: Documentation, version, package, and release

**Files:** Modify `README.md`, the existing architecture/operating/integration authority files, `SECURITY.md`, `CHANGELOG.md`, package/runtime/template versions, and project state.

**Interfaces:** Publish version `0.2.0` consistently across package, runtime, template, changelog, tag, and release.

- [ ] Document install, project enable/disable, verify, uninstall, trust review, bounded output, manual validation hints, and Throughline responsibility separation.
- [ ] Keep `docs/README.md` at or below 50 lines and every Active Authority file at or below 500 lines.
- [ ] Update durable state only with observed test and release evidence.
- [ ] Run Hook focused tests, automation tests, existing CLI regressions, `npm test`, `npm run check`, `npm run smoke:template`, `npm run verify`, `npm pack --dry-run`, isolated package install/version/help smoke, real-HOME install dry-run, read-only Hook verify, and `git diff --check`.
- [ ] Commit logical green slices, create annotated `v0.2.0`, push `main` and the tag, and create the GitHub Release without changing remote visibility or publishing to npm.
