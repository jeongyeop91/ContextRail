# Existing Repository Adoption Implementation Plan (completed)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe `existing-repository` adoption profile that maps existing authority and state without creating competing project memory.

**Architecture:** A new pure adoption module validates and normalizes the profile, then produces a three-file managed scaffold plan. Existing document, state, routing, and continuity modules branch only on the normalized config shape: legacy `authorityDirectory` and native JSON state remain unchanged, while `authority.roots` and `state.mode=references` use existing repository files without parsing project-specific backlog formats.

**Tech Stack:** Node.js 22.13+, ECMAScript modules, `node:test`, JSON, Markdown, Git.

**Spec:** `docs/authority/ARCHITECTURE.md` and the approved existing-repository adoption contract for this task.

## Global Constraints

- Work directly on the existing `main`; do not create branches, worktrees, or subagents.
- Keep existing `init`, neutral `adopt`, `upgrade`, and native JSON state behavior compatible.
- Never modify user-owned instructions, router, authority, state, plan, or backlog files.
- Existing-repository adoption may create only `.context-rail/config.json`, `.context-rail/version.json`, and `.context-rail/.gitignore`.
- `.context-rail/.gitignore` contains exactly `runtime/` and the root `.gitignore` is never changed.
- Config paths must be repository-relative, normalized, and confined to the target root.
- Validation hints are non-empty argv arrays and are never executed automatically.
- The Security reference repository remains read-only; only a final dry-run is allowed.
- Do not change Throughline integration or any global Codex configuration.

---

### Task 1: Adoption profile contract and managed-file plan

**Files:**
- Create: `src/core/adoption.mjs`
- Create: `test/adoption.test.mjs`
- Create: `test/fixtures/existing-repository/**`
- Modify: `src/core/scaffold.mjs`
- Modify: `src/cli/main.mjs`
- Modify: `test/scaffold.test.mjs`
- Modify: `test/cli.test.mjs`

**Interfaces:**
- Produces: `normalizeAdoptionConfig(value)`, `validateAdoptionConfig(target, value, fs)`, and `planExistingRepositoryAdoption({target, config, fs})`.
- Produces: a scaffold-compatible plan whose operations contain only the three managed `.context-rail` paths.
- CLI: `adopt --profile existing-repository --adoption-config FILE --dry-run|--apply`.

- [ ] **Step 1: Create a mature-repository fixture and failing adoption tests**

Fixture content includes existing root/nested `AGENTS.md`, a routed authority tree, an existing Markdown current-state file, a plan directory, and a non-JSON backlog. Tests assert that dry-run creates no neutral authority or state files.

- [ ] **Step 2: Add failing config, path, conflict, dry-run, apply, and ownership tests**

Cover schema/profile mismatch, missing config, absolute and `..` paths, invalid validation hints, existing different config, no dry-run writes, exact three managed paths, `runtime/` content, and ownership hashes for only files created by ContextRail.

- [ ] **Step 3: Run focused tests and confirm expected failures**

Run: `node --test test/adoption.test.mjs test/scaffold.test.mjs test/cli.test.mjs`

Expected: failures because the existing-repository profile and CLI options do not exist.

- [ ] **Step 4: Implement the minimal adoption profile and atomic apply path**

Normalize relative POSIX-style config paths, reject unknown/unsafe execution shapes, serialize config deterministically, plan conflicts instead of overwrites, and write each managed file through a sibling temporary file plus rename. Preserve the existing neutral scaffold path.

- [ ] **Step 5: Run focused and native scaffold regression tests**

Run: `node --test test/adoption.test.mjs test/scaffold.test.mjs test/cli.test.mjs`

Expected: all focused tests pass; legacy neutral `init` and `adopt` tests remain green.

- [ ] **Step 6: Commit the independently green adoption slice**

```bash
git add src/core/adoption.mjs src/core/scaffold.mjs src/cli/main.mjs test/adoption.test.mjs test/scaffold.test.mjs test/cli.test.mjs test/fixtures/existing-repository
git commit -m "feat: add existing repository adoption profile"
```

---

### Task 2: Recursive authority roots and reference state

**Files:**
- Modify: `src/core/documents.mjs`
- Modify: `src/core/state.mjs`
- Modify: `src/core/routing.mjs`
- Modify: `src/core/continuity.mjs`
- Modify: `src/cli/main.mjs`
- Modify: `test/documents.test.mjs`
- Modify: `test/state.test.mjs`
- Modify: `test/routing.test.mjs`
- Modify: `test/continuity.test.mjs`
- Modify: `test/cli.test.mjs`

**Interfaces:**
- `validateDocuments` accepts either legacy `authorityDirectory` or normalized `authority.roots` plus `authority.exclude`.
- `validateState` returns reference summaries without parsing backlog bodies when `state.mode === 'references'`.
- `buildRoute` and `buildContinuation` return reference paths and `validationHints` without executing them.

- [ ] **Step 1: Write failing recursive authority tests**

Cover recursive Markdown discovery, file and directory exclusions, missing roots, duplicate discovered paths, unindexed active authority, line limits, relative links, heading anchors, and root escape rejection. Retain the existing single-directory test set.

- [ ] **Step 2: Write failing reference-state, route, and continue tests**

Assert existence-only reference validation, non-JSON backlog acceptance, structured check summary, hierarchical instructions, router-linked documents, reference paths, argv hints, and a deterministic references-mode continuation message. Assert native JSON continuation remains unchanged.

- [ ] **Step 3: Run focused tests and confirm failures**

Run: `node --test test/documents.test.mjs test/state.test.mjs test/routing.test.mjs test/continuity.test.mjs test/cli.test.mjs`

Expected: new reference-mode cases fail while native cases remain green.

- [ ] **Step 4: Implement the minimal config-shape branches**

Recursively walk each authority root through the injected filesystem adapter, apply normalized exclusions, record duplicate discovery, and validate links on the router plus active authority. In references state mode check only mapped path types and return validation hints. Route and continue must not parse the backlog or execute hints.

- [ ] **Step 5: Run focused tests and the full suite**

Run:

```bash
node --test test/documents.test.mjs test/state.test.mjs test/routing.test.mjs test/continuity.test.mjs test/cli.test.mjs
npm test
npm run check
```

Expected: all tests pass and ContextRail's native self-check stays green.

- [ ] **Step 6: Commit the independently green reference-mapping slice**

```bash
git add src/core/documents.mjs src/core/state.mjs src/core/routing.mjs src/core/continuity.mjs src/cli/main.mjs test
git commit -m "feat: map existing repository authority and state"
```

---

### Task 3: Read-only Security dry-run and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/authority/ARCHITECTURE.md`
- Modify: `docs/authority/OPERATING_MODEL.md`
- Modify if needed: `docs/authority/DOCUMENT_GOVERNANCE.md`
- Modify: `state/CURRENT.md`
- Modify: `state/BACKLOG.json`
- Move completed plan to: `docs/history/plans/2026-08-27-existing-repository-adoption.md`

**Interfaces:**
- Documents the normalized adoption schema, preserved/managed files, native/reference boundary, and manual validation-hint policy.

- [ ] **Step 1: Run a read-only Security adoption dry-run**

Create a temporary config outside the Security repository, run the exact existing-repository dry-run, and assert that only the three `.context-rail` paths are planned as creates. Assert forbidden project-owned paths are never create, update, or ownership targets. Capture the Security HEAD and clean status before and after.

- [ ] **Step 2: Document existing-repository adoption without duplicating authority**

Put user workflow and example schema in `README.md`; put native/reference boundaries in architecture; put preservation and non-execution rules in operating model. Keep the router at or below 50 lines and every Active Authority file at or below 500 lines.

- [ ] **Step 3: Finalize file memory**

Mark the adoption backlog item done, record verified commands and Security read-only evidence in CURRENT, archive this completed plan, and restore the single pre-publication active plan.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npm test
npm run check
npm run smoke:template
npm run verify
git diff --check
git status --short --branch
```

Expected: the complete suite passes, project contracts pass, the generated neutral template still validates, and only intended documentation/state changes remain.

- [ ] **Step 5: Commit documentation and verified memory**

```bash
git add README.md docs state
git commit -m "docs: document existing repository adoption"
git status --short --branch
```
