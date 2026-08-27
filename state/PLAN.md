# ContextRail MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosting GitHub Template foundation with project-local context routing, validated file memory, local measurements, and an optional reproducible Throughline compatibility installer.

**Architecture:** A dependency-free Node.js CLI calls pure core modules through filesystem and process adapters. Core functions return structured results; all writes and external commands remain at the edges. Throughline is a separately versioned adapter whose source, patch, tests, managed installation prefix, and live verification states are explicit.

**Tech Stack:** Node.js 22.13+, ECMAScript modules, Node built-in `node:test`, JSON, Markdown, Git, npm, GitHub Actions.

**Spec:** `docs/authority/ARCHITECTURE.md`

## Global Constraints

- The MVP uses Node.js 22.13 or newer and no production npm dependencies.
- Core functionality must work without Throughline, Codex, network access, or a global package installation.
- Default validation is offline and never changes the user HOME.
- Existing files, hooks, settings, and global `node_modules` are never silently overwritten.
- Every write-capable command has a dry-run or explicit apply boundary.
- The document index is at most 50 lines and Active Authority documents are at most 500 lines.
- Raw transcripts, secrets, personal absolute paths, and Rathon product material must not enter the repository.
- The current repository uses branch `main` and repository-local Git identity `Jeongyeop <jylee91@gmail.com>`.

---

### Task 1: Self-hosting project foundation

**Files:**
- Create: `AGENTS.md`
- Create: `src/AGENTS.md`
- Create: `test/AGENTS.md`
- Create: `integrations/throughline/AGENTS.md`
- Create: `docs/README.md`
- Create: `docs/authority/PROJECT.md`
- Create: `docs/authority/OPERATING_MODEL.md`
- Create: `docs/authority/DOCUMENT_GOVERNANCE.md`
- Create: `docs/authority/VALIDATION.md`
- Create: `docs/authority/CONTINUITY.md`
- Create: `docs/authority/MEASUREMENT.md`
- Create: `docs/authority/INTEGRATIONS.md`
- Create: `docs/adr/README.md`
- Create: `docs/adr/0001-template-and-local-cli.md`
- Create: `docs/history/README.md`
- Create: `docs/generated/README.md`
- Create: `docs/reference/README.md`
- Create: `state/CURRENT.md`
- Create: `state/BACKLOG.json`
- Create: `.context-rail/config.json`
- Create: `.context-rail/version.json`
- Create: `.gitignore`
- Create: `package.json`

**Interfaces:**
- Consumes: the approved architecture and the repository-local Git configuration.
- Produces: the canonical directory classifications, state schema examples, command scripts, and validation limits consumed by later tasks.

- [ ] **Step 1: Add a failing foundation contract test**

Create `test/foundation.test.mjs` using `node:test`. It reads the repository root, asserts all required paths exist, asserts `docs/README.md` has no more than 50 lines, and asserts every `docs/authority/*.md` file has no more than 500 lines.

```js
test('self-hosting foundation exists', async () => {
  for (const relative of REQUIRED_PATHS) {
    assert.equal(existsSync(join(ROOT, relative)), true, relative);
  }
});
```

- [ ] **Step 2: Run the test and confirm the missing-foundation failure**

Run: `node --test test/foundation.test.mjs`

Expected: FAIL because `AGENTS.md`, the document router, state files, and configuration are absent.

- [ ] **Step 3: Add the minimal self-hosting foundation**

Use concise project-neutral instructions. `state/CURRENT.md` references `CR-001`; `state/BACKLOG.json` defines `CR-001` through `CR-004` with statuses, dependencies, acceptance, authority paths, and validation commands. `package.json` declares Node `>=22.13`, `type: module`, `bin.contextrail`, and scripts `test`, `check`, and `verify`.

- [ ] **Step 4: Run the foundation test and structural spot checks**

Run:

```bash
node --test test/foundation.test.mjs
wc -l AGENTS.md docs/README.md docs/authority/*.md
git diff --check
```

Expected: foundation test PASS, index at most 50 lines, authority files at most 500 lines, and no whitespace errors.

- [ ] **Step 5: Commit the foundation**

```bash
git add AGENTS.md src/AGENTS.md test/AGENTS.md integrations/throughline/AGENTS.md docs state .context-rail .gitignore package.json test/foundation.test.mjs
git commit -m "feat: establish ContextRail project foundation"
```

---

### Task 2: Document and state validator

**Files:**
- Create: `src/core/result.mjs`
- Create: `src/core/markdown.mjs`
- Create: `src/core/documents.mjs`
- Create: `src/core/state.mjs`
- Create: `src/adapters/filesystem.mjs`
- Create: `src/cli/main.mjs`
- Create: `bin/contextrail.mjs`
- Create: `test/documents.test.mjs`
- Create: `test/state.test.mjs`
- Create: `test/fixtures/invalid-docs/`

**Interfaces:**
- Consumes: `.context-rail/config.json`, classified project paths, `CURRENT.md`, `PLAN.md`, and `BACKLOG.json`.
- Produces: `validateProject(root): Promise<{ok:boolean, issues:Issue[], summary:object}>` and CLI `check` output/exit codes.

- [ ] **Step 1: Write failing document-governance tests**

Tests cover a missing index, unindexed authority file, 501-line authority file, missing relative file link, missing heading anchor, escaped `../` path, and a valid repository.

```js
const result = await validateDocuments(fixtureRoot, config, fsAdapter);
assert.equal(result.issues.some((issue) => issue.code === 'AUTHORITY_TOO_LARGE'), true);
```

- [ ] **Step 2: Run the focused document test**

Run: `node --test test/documents.test.mjs`

Expected: FAIL because validator modules do not exist.

- [ ] **Step 3: Implement Markdown and document validation**

Implement relative link extraction, GitHub-style heading normalization for repository headings, line limits, authority-index membership, required directories, and root confinement. Return stable issue objects `{code, path, message, severity}` sorted by path and code.

- [ ] **Step 4: Write failing state-contract tests**

Tests cover duplicate backlog IDs, unknown dependency, cyclic dependencies, invalid status, CURRENT referencing a missing item, CURRENT referencing a done item, missing active plan, and two active plan files.

- [ ] **Step 5: Implement state and plan validation**

Supported backlog statuses are `proposed`, `ready`, `in_progress`, `blocked`, `done`, and `dropped`. Parse the constrained `Active item: \`ID\`` line from CURRENT. Verify that `in_progress` is unique and matches CURRENT, dependencies exist and are acyclic, and validation arrays contain argv arrays rather than shell strings.

- [ ] **Step 6: Wire the `check` CLI**

`bin/contextrail.mjs` imports `run` from `src/cli/main.mjs`. The parser supports `check [--target PATH] [--json]`; human output reports counts and the first relevant failure, while JSON emits the complete structured result. Exit `1` for violations and `2` for invalid CLI usage.

- [ ] **Step 7: Run validator tests and self-check**

Run:

```bash
node --test test/documents.test.mjs test/state.test.mjs
node bin/contextrail.mjs check --json
npm test
```

Expected: all tests PASS and self-check returns `ok: true`.

- [ ] **Step 8: Commit the validator**

```bash
git add bin src test package.json
git commit -m "feat: validate ContextRail documents and state"
```

---

### Task 3: Bootstrap, adoption, upgrade planning, route, and continue

**Files:**
- Create: `src/core/scaffold.mjs`
- Create: `src/core/routing.mjs`
- Create: `src/core/continuity.mjs`
- Create: `src/adapters/git.mjs`
- Create: `templates/project/manifest.json`
- Create: `templates/project/AGENTS.md`
- Create: `templates/project/docs/README.md`
- Create: `templates/project/docs/authority/PROJECT.md`
- Create: `templates/project/state/CURRENT.md`
- Create: `templates/project/state/PLAN.md`
- Create: `templates/project/state/BACKLOG.json`
- Create: `templates/project/.context-rail/config.json`
- Create: `templates/scope/AGENTS.md`
- Create: `test/scaffold.test.mjs`
- Create: `test/routing.test.mjs`
- Create: `test/continuity.test.mjs`
- Modify: `src/cli/main.mjs`

**Interfaces:**
- Consumes: template manifest, target filesystem snapshot, config, instruction files, CURRENT, PLAN, and BACKLOG.
- Produces: `planScaffold(options)`, `applyScaffold(plan)`, `buildRoute(root,target)`, and `buildContinuation(root)` plus CLI commands.

- [ ] **Step 1: Write failing scaffold safety tests**

Tests create temporary empty and non-empty targets. They assert dry-run writes nothing, conflicts are reported, absolute personal paths are absent, path traversal is rejected, and applied output passes `validateProject`.

- [ ] **Step 2: Implement plan-first scaffold operations**

Represent every operation as `{action:'create'|'update'|'skip'|'conflict', path, contentHash, reason}`. `init` requires an empty target except `.git`; `adopt` creates only missing owned files; `upgrade` updates a scaffold-owned file only when its current SHA-256 matches the recorded prior owned hash. No generic force-overwrite flag is provided.

- [ ] **Step 3: Write failing route tests**

Fixtures contain root and nested `AGENTS.md`. Assert root-to-target order, no sibling instruction inclusion, instruction byte totals, router documents, current item, and validation argv output.

- [ ] **Step 4: Implement routing**

`buildRoute` walks from repository root to the target parent, collecting one non-empty `AGENTS.md` per directory. It returns relative paths only and reads configuration-defined document and state entry points.

- [ ] **Step 5: Write failing continue tests**

Cover a valid in-progress item, a blocked current item, missing CURRENT reference, mismatched in-progress item, and selection of a unique ready item only when CURRENT has no active item.

- [ ] **Step 6: Implement deterministic continuation**

Return `{status, instructionFiles, currentItem, nextSteps, authorityFiles, sourceHints, validation}`. Do not run a model, Git mutation, or tests. Ambiguity returns `status: 'needs_input'` with stable issue codes.

- [ ] **Step 7: Wire and test all commands**

Run:

```bash
node --test test/scaffold.test.mjs test/routing.test.mjs test/continuity.test.mjs
node bin/contextrail.mjs init --target "$(mktemp -d)" --dry-run --json
node bin/contextrail.mjs route src/core/documents.mjs --json
node bin/contextrail.mjs continue --json
npm test
```

Expected: focused tests and full repository tests PASS; dry-run reports creates but writes nothing.

- [ ] **Step 8: Commit the context workflow**

```bash
git add src templates test bin
git commit -m "feat: add safe bootstrap and context routing"
```

---

### Task 4: Local measurement and reproducible reports

**Files:**
- Create: `src/core/measurement.mjs`
- Create: `test/measurement.test.mjs`
- Modify: `src/cli/main.mjs`
- Modify: `.gitignore`
- Modify: `docs/authority/MEASUREMENT.md`

**Interfaces:**
- Consumes: explicit metric values and provenance plus local runtime JSONL.
- Produces: `validateMeasurement`, `appendMeasurement`, and `summarizeMeasurements` with separated measured and estimated aggregates.

- [ ] **Step 1: Write failing measurement tests**

Test accepted provenance, rejection of negative counts and secrets/raw text fields, exact/estimated separation, context ratios, handoff estimates, and empty reports.

- [ ] **Step 2: Implement the measurement schema**

A record contains `schema`, `recordedAt`, `taskId`, `sessionIdHash`, `source`, and numeric `metrics`. Allowed sources are `host_reported`, `tool_reported`, `manual`, and `estimated`. The schema rejects transcript, prompt, response, token, secret, and path body fields.

- [ ] **Step 3: Implement local record and report commands**

Write JSONL only under `.context-rail/runtime/measurements.jsonl`. Create the runtime directory on demand. `measure report` groups by metric and provenance and emits counts, totals, averages, min, and max without combining estimates with reported values.

- [ ] **Step 4: Run focused tests and a local smoke**

Run:

```bash
node --test test/measurement.test.mjs
node bin/contextrail.mjs measure record --task CR-001 --source manual --input-tokens 100 --output-tokens 20
node bin/contextrail.mjs measure report --json
git status --short
```

Expected: tests PASS, report separates provenance, and runtime measurement data remains Git-ignored.

- [ ] **Step 5: Commit measurement support**

```bash
git add src test .gitignore docs/authority/MEASUREMENT.md
git commit -m "feat: record local context measurements"
```

---

### Task 5: Throughline provenance and patch preparation

**Files:**
- Create: `integrations/throughline/source.json`
- Create: `integrations/throughline/LICENSE`
- Create: `integrations/throughline/README.md`
- Create: `integrations/throughline/patches/0001-support-current-codex-rollout.patch`
- Create: `src/integrations/throughline-manifest.mjs`
- Create: `src/integrations/throughline-prepare.mjs`
- Create: `src/adapters/process.mjs`
- Create: `test/throughline-manifest.test.mjs`
- Create: `test/throughline-prepare.test.mjs`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `src/cli/main.mjs`

**Interfaces:**
- Consumes: pinned repository/base/compatibility SHA, patch SHA-256, Git executable, Node/npm, temporary root, and process adapter.
- Produces: `loadThroughlineManifest`, `planPreparation`, and `prepareThroughline` with bounded structured evidence.

- [ ] **Step 1: Generate and inspect the reproducible patch**

Generate the patch content from local commit `4d94defd2057df25eb24dc402d7b6c06fa1264d4` against parent `4bf84f548eeb7173a3b46be33b9b0c54723ab21f` using `git format-patch --stdout --full-index --binary -1`. Store it through the normal file-edit mechanism, compute SHA-256, and record it in `source.json` with the canonical URL and MIT license.

- [ ] **Step 2: Write failing manifest tests**

Assert exact 40-hex SHAs, HTTPS GitHub URL, patch hash match, allowed test argv, removal condition, license presence, and absence of mutable branch references.

- [ ] **Step 3: Implement manifest validation**

Reject unknown keys that affect execution, shell command strings, non-HTTPS sources, missing hashes, patch mismatch, and test commands not expressed as argv arrays.

- [ ] **Step 4: Write failing preparation tests with a local fake upstream**

Create a temporary Git repository, commit a base file, generate a compatible patch fixture, and verify clone/checkout/head/apply-check/apply/test/pack call order through a recording process adapter. Add cases for wrong HEAD, patch rejection, test failure, and cleanup.

- [ ] **Step 5: Implement safe preparation**

Use `mkdtemp`, `spawn` with argv arrays, exact checkout, `git rev-parse HEAD`, `git apply --check`, `git apply`, configured tests, and `npm pack --json`. Return paths only in explicit local diagnostic output; structured committed evidence stores hashes and relative identifiers.

- [ ] **Step 6: Run local fixture tests and real-source dry run**

Run:

```bash
node --test test/throughline-manifest.test.mjs test/throughline-prepare.test.mjs
node bin/contextrail.mjs throughline prepare --dry-run --json
```

If network preparation is run, verify it checks out only the pinned SHA and does not install or edit HOME.

- [ ] **Step 7: Commit provenance and preparation**

```bash
git add integrations/throughline src/integrations src/adapters/process.mjs test THIRD_PARTY_NOTICES.md
git commit -m "feat: pin and prepare Throughline compatibility patch"
```

---

### Task 6: Throughline managed install, verify, and rollback

**Files:**
- Create: `src/integrations/throughline-install.mjs`
- Create: `src/integrations/throughline-verify.mjs`
- Create: `test/throughline-install.test.mjs`
- Create: `test/throughline-verify.test.mjs`
- Modify: `src/cli/main.mjs`
- Modify: `docs/authority/INTEGRATIONS.md`
- Modify: `integrations/throughline/README.md`

**Interfaces:**
- Consumes: prepared tarball, selected managed data root, HOME snapshot adapter, discovered installation, and documented Throughline diagnostics.
- Produces: install plan, explicit apply, readiness state, and guarded rollback.

- [ ] **Step 1: Write failing install safety tests**

Use a temporary HOME and prefix. Assert dry-run makes no changes, selected paths remain inside the managed root, existing unrelated hooks survive, install failure leaves the previous `current` selection, and explicit apply is required.

- [ ] **Step 2: Implement versioned managed installation**

Install with npm `--prefix` into a release directory named from version and patch hash. Write an installation receipt containing artifact, source, patch, config-before, and config-after hashes. Switch `current.json` only after package and temp-HOME verification succeed. Do not edit shell startup files.

- [ ] **Step 3: Write failing verification tests**

Fixtures cover absent, prepared, installed, hooks-ready, capture-verified, degraded, and incompatible states. Ensure registered hooks without non-zero bodies never produce capture-verified.

- [ ] **Step 4: Implement verification adapters**

Invoke the selected binary for `--version`, `factory-diagnostics --json`, and human `doctor --codex` passthrough. Live verification accepts only structured capture evidence for non-zero L2 bodies, L3 details, and injected-context exclusions. Never read the Throughline database directly.

- [ ] **Step 5: Implement guarded rollback**

Rollback selects the prior managed receipt, compares current hashes with the recorded post-install hashes, refuses on concurrent change, invokes the prior binary's installer when safe, verifies it, and updates `current.json` atomically. It removes only ContextRail-managed release data after explicit cleanup.

- [ ] **Step 6: Run temporary-HOME integration tests and current-host read-only verify**

Run:

```bash
node --test test/throughline-install.test.mjs test/throughline-verify.test.mjs
node bin/contextrail.mjs throughline install --dry-run --json
node bin/contextrail.mjs throughline verify --json
npm test
```

Expected: all tests PASS; dry-run changes nothing; current-host verification reports its actual state without mutating HOME.

- [ ] **Step 7: Commit installation support**

```bash
git add src test docs/authority/INTEGRATIONS.md integrations/throughline/README.md
git commit -m "feat: manage optional Throughline installation"
```

---

### Task 7: Template, CI, documentation, and release-readiness review

**Files:**
- Create: `README.md`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `THIRD_PARTY_NOTICES.md` if not created earlier
- Create: `.github/workflows/verify.yml`
- Modify: `docs/README.md`
- Modify: `state/CURRENT.md`
- Modify: `state/PLAN.md`
- Modify: `state/BACKLOG.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: all implemented commands, tests, and validation evidence.
- Produces: GitHub Template-ready local repository and final verification report, pending only ContextRail license and remote-repository choices.

- [ ] **Step 1: Write the user-facing workflows**

Document standalone template use, existing-project adoption, offline check, route/continue, measurement provenance, Throughline prepare/dry-run/explicit apply/verify/rollback, no-Throughline operation, supported Node version, and the fact that no performance reduction is claimed without evidence.

- [ ] **Step 2: Add CI**

Use `actions/checkout` and `actions/setup-node` with Node 22. Run `npm test`, `node bin/contextrail.mjs check`, `git diff --check`, and a generated-project temporary-directory smoke. Do not run real HOME or live Throughline installation in CI.

- [ ] **Step 3: Run the full local verification suite**

Run:

```bash
npm test
node bin/contextrail.mjs check --json
node bin/contextrail.mjs continue --json
node bin/contextrail.mjs throughline install --dry-run --json
node bin/contextrail.mjs throughline verify --json
git diff --check
```

Record exact pass counts and degraded external integration states without promoting them to success.

- [ ] **Step 4: Review scope, secrets, paths, and licenses**

Run targeted searches for Rathon product terms, personal absolute paths, common credential assignments, private keys, generated archives, and copied Throughline source. Confirm only the patch, license, notices, manifest, and synthetic fixtures are present.

```bash
rg -n '/Users/|Rathon Directory|BEGIN .*PRIVATE KEY|api[_-]?key|access[_-]?token' . -g '!docs/history/**'
git status --short
git diff --stat HEAD~1..HEAD
```

- [ ] **Step 5: Finalize project memory**

Set all completed backlog items to `done`, summarize verified commands and limitations in CURRENT, set the next action to choosing the ContextRail license and GitHub remote settings, and move the completed active plan to `docs/history/plans/2026-08-27-contextrail-mvp.md` while leaving no second active plan.

- [ ] **Step 6: Run verification after memory finalization**

Run: `npm run verify`

Expected: all tests, self-validation, generated-template smoke, and diff checks PASS.

- [ ] **Step 7: Commit the release-ready local state**

```bash
git add .
git commit -m "docs: prepare ContextRail template for publication"
git status --short --branch
```

Expected: clean `main` with reviewable commits. Do not create a remote or push. ContextRail project license, GitHub visibility, owner, and final repository name remain the only pre-push user decisions.
