# Cross-platform Full Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a GitHub Release-backed `contextrail setup` that safely configures ContextRail Core, the pinned Codex-compatible Throughline, ContextRail Codex Hooks, and project automation on macOS, Linux, and native Windows.

**Architecture:** A pure setup planner classifies the project and composes existing component plans into a hash-identified setup plan. Effectful adapters download and verify release assets, resolve native data paths and JavaScript package entry points, and apply the approved steps through their existing ownership boundaries; a receipt records resumable progress without claiming a cross-filesystem transaction. The CLI provides interactive confirmation only on a TTY, while `--dry-run` and `--apply` remain the machine-readable boundaries.

**Tech Stack:** Node.js 22.13+ standard library, `node:test`, GitHub Actions, npm package tarballs, GitHub Releases.

**Spec:** `docs/adr/0003-cross-platform-full-install.md`, `docs/adr/0004-interactive-quickstart.md`

## Global Constraints

- Core operation must not require Throughline, a network, or a global package.
- Write-capable commands plan first and require either an affirmative TTY confirmation or explicit `--apply`.
- Supported platforms are `darwin`, `linux`, and native `win32`; WSL is a separate Linux environment.
- Runtime processes use executable-plus-argv arrays and never depend on a POSIX shell.
- Release downloads are selected by an embedded manifest and SHA-256 verified before installation.
- Existing repositories require an explicit adoption config; setup never guesses semantic mappings.
- Unmanaged Throughline installations are preserved and never overwritten.
- Windows live Codex evidence remains pending until the user completes the supplied pilot checklist.
- npm registry publication is outside this plan; installation uses GitHub Release tarballs.

---

## File Structure

- `src/core/setup.mjs`: pure project classification, option validation, component ordering, plan identity, and resumable state decisions.
- `src/adapters/platform.mjs`: native managed-data roots, WSL/native-host checks, and JavaScript package-bin resolution.
- `src/adapters/release.mjs`: HTTPS download to a temporary directory and streaming SHA-256 verification.
- `src/integrations/release-manifest.mjs`: embedded release-manifest validation and selection.
- `src/integrations/setup.mjs`: effectful discovery, component plan composition, apply/resume orchestration, and aggregate verification.
- `src/integrations/codex-hooks.mjs`: portable `command` plus `commandWindows` Hook entries.
- `src/integrations/throughline-install.mjs`: direct Node invocation of the installed Throughline JavaScript bin.
- `src/cli/main.mjs`: setup arguments, TTY confirmation, JSON output, and exit codes.
- `scripts/build-release.mjs`: deterministic ContextRail alias/versioned assets, patched Throughline artifact, manifest, and checksum generation.
- `.github/workflows/verify.yml`: packed-artifact setup matrix on Ubuntu, macOS, and Windows.
- `.github/workflows/release.yml`: verified prerelease asset publication from a version tag.
- `test/setup*.test.mjs`, `test/platform.test.mjs`, `test/release-manifest.test.mjs`: focused deterministic coverage.
- `README.md`, `docs/reference/WINDOWS_PILOT.md`, `integrations/throughline/README.md`: two-command onboarding, mode selection, recovery, and honest live validation.

### Task 1: Release manifest and verified artifact download

**Files:**
- Create: `src/integrations/release-manifest.mjs`
- Create: `src/adapters/release.mjs`
- Create: `integrations/release-manifest.json`
- Create: `test/release-manifest.test.mjs`
- Create: `test/release-download.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateReleaseManifest(value) -> { ok, issues, manifest? }`
- Produces: `loadReleaseManifest({ root, fs }) -> Promise<{ ok, issues, manifest? }>`
- Produces: `selectReleaseArtifact(manifest, name) -> { name, url, sha256 }`
- Produces: `downloadVerifiedArtifact({ artifact, destination, http, fs }) -> Promise<{ path, sha256, bytes }>`

- [ ] **Step 1: Write manifest tests that reject mutable URLs, unknown platforms, malformed digests, and mismatched package/runtime metadata.**

```js
const result = validateReleaseManifest({ ...validManifest, artifacts: [{ name: 'throughline', url: 'https://example.invalid/latest/x.tgz', sha256: 'bad' }] });
assert.equal(result.ok, false);
assert.deepEqual(result.issues.map(({ code }) => code), ['MUTABLE_RELEASE_ARTIFACT_URL', 'INVALID_RELEASE_ARTIFACT_SHA256']);
```

- [ ] **Step 2: Run `node --test test/release-manifest.test.mjs` and confirm the missing module failure.**
- [ ] **Step 3: Implement strict schema validation and embed a development manifest whose immutable asset metadata matches the release build inputs.**

```js
export function selectReleaseArtifact(manifest, name) {
  const artifact = manifest.artifacts.find((entry) => entry.name === name);
  if (!artifact) throw new Error(`Release artifact is not declared: ${name}`);
  return structuredClone(artifact);
}
```

- [ ] **Step 4: Write download tests with an injected HTTPS adapter, including digest rejection and cleanup of the partial file.**
- [ ] **Step 5: Implement streamed download and SHA-256 verification without following a redirect outside `github.com` or `objects.githubusercontent.com`.**
- [ ] **Step 6: Run `node --test test/release-manifest.test.mjs test/release-download.test.mjs` and confirm all tests pass.**
- [ ] **Step 7: Commit `feat: add verified release artifacts`.**

### Task 2: Native paths and direct JavaScript package-bin execution

**Files:**
- Create: `src/adapters/platform.mjs`
- Create: `test/platform.test.mjs`
- Modify: `src/integrations/throughline-install.mjs`
- Modify: `src/integrations/throughline-verify.mjs`
- Modify: `test/throughline-install.test.mjs`
- Modify: `test/throughline-verify.test.mjs`

**Interfaces:**
- Produces: `managedDataRoot({ platform, home, env }) -> absolute path`
- Produces: `resolvePackageBin({ installRoot, packageName, fs }) -> Promise<absolute JS path>`
- Produces: `nodeBinCommand({ nodePath, binPath, args }) -> { executable, args }`
- Consumes: `processAdapter.run(executable, args, options)`

- [ ] **Step 1: Write table tests for macOS Application Support, Linux XDG/fallback, Windows LOCALAPPDATA, spaces, non-ASCII paths, and missing required environment roots.**
- [ ] **Step 2: Write Throughline installation tests that require calls shaped as `[nodePath, [resolvedBin, ...args]]`, never `.bin/throughline` or `.cmd`.**
- [ ] **Step 3: Run `node --test test/platform.test.mjs test/throughline-install.test.mjs test/throughline-verify.test.mjs` and confirm failures expose the Unix-only paths.**
- [ ] **Step 4: Implement platform path selection and package.json `bin` resolution confined to the installed package directory.**

```js
export function nodeBinCommand({ nodePath, binPath, args = [] }) {
  if (!isAbsolute(nodePath) || !isAbsolute(binPath)) throw new Error('Node and package bin paths must be absolute');
  return { executable: nodePath, args: [binPath, ...args] };
}
```

- [ ] **Step 5: Refactor managed install, verification, and rollback to invoke the resolved JavaScript entry with the selected absolute Node executable.**
- [ ] **Step 6: Run the three focused test files and confirm they pass.**
- [ ] **Step 7: Commit `fix: make managed Throughline portable`.**

### Task 3: Cross-platform Codex Hook commands

**Files:**
- Modify: `src/integrations/codex-hooks.mjs`
- Modify: `src/cli/main.mjs`
- Modify: `test/codex-hooks.test.mjs`
- Modify: `test/codex-hooks-cli.test.mjs`

**Interfaces:**
- Produces: `encodePosixCommand(argv) -> string`
- Produces: `encodePowerShellCommand(argv) -> string`
- Changes: each owned command handler contains both `command` and `commandWindows`

- [ ] **Step 1: Replace Unix-only assertions with platform-neutral fixtures that include spaces, apostrophes, ampersands, Unicode, and a Windows drive path.**
- [ ] **Step 2: Run `node --test test/codex-hooks.test.mjs test/codex-hooks-cli.test.mjs` and confirm `commandWindows` is absent.**
- [ ] **Step 3: Implement POSIX single-quote and PowerShell single-quote encoders over argv values and generate both handler fields.**

```js
const handler = {
  type: 'command',
  command: encodePosixCommand([nodePath, cliPath, 'hook', eventName]),
  commandWindows: encodePowerShellCommand([nodePath, cliPath, 'hook', eventName]),
};
```

- [ ] **Step 4: Include `commandWindows` in public plan output and exact ownership verification while preserving all non-owned handlers.**
- [ ] **Step 5: Run both focused test files and confirm install, idempotence, conflict, uninstall, and quoting cases pass.**
- [ ] **Step 6: Commit `fix: register portable Codex hooks`.**

### Task 4: Pure setup planning and conservative project discovery

**Files:**
- Create: `src/core/setup.mjs`
- Create: `test/setup-core.test.mjs`

**Interfaces:**
- Produces: `normalizeSetupOptions(input) -> { ok, issues, options? }`
- Produces: `classifyProject(entries, contextRailConfigState) -> 'new'|'configured'|'existing'`
- Produces: `buildSetupPlan({ options, discovery, components }) -> { schema, id, status, profile, project, steps, issues }`
- Produces: `setupPlanId(publicPlan) -> sha256`

- [ ] **Step 1: Write option tests for the full default, `--core-only`, `--no-context-hooks`, `--use-existing-throughline`, and every incompatible combination.**
- [ ] **Step 2: Write classification tests for empty, `.git`-only, configured, malformed config, and non-empty existing targets with candidate path reporting.**
- [ ] **Step 3: Write deterministic identity tests proving a precondition hash or selected artifact change produces a different plan ID.**
- [ ] **Step 4: Run `node --test test/setup-core.test.mjs` and confirm the missing module failure.**
- [ ] **Step 5: Implement pure normalization, classification, ordered step composition, stable JSON canonicalization, and SHA-256 plan identity.**
- [ ] **Step 6: Run the focused test and confirm it passes.**
- [ ] **Step 7: Commit `feat: plan full ContextRail setup`.**

### Task 5: Setup discovery, apply, resume, and aggregate verification

**Files:**
- Create: `src/integrations/setup.mjs`
- Create: `test/setup-integration.test.mjs`
- Modify: `src/integrations/throughline-install.mjs`
- Modify: `src/integrations/codex-hooks.mjs`
- Modify: `src/core/automation.mjs`

**Interfaces:**
- Produces: `discoverSetup({ target, options, home, platform, env, fs, processAdapter, releaseManifest }) -> Promise<discovery>`
- Produces: `planSetup(dependencies) -> Promise<setupPlan>`
- Produces: `applySetup({ plan, approvedPlanId, dependencies }) -> Promise<setupResult>`
- Produces: `verifySetup({ target, home, ...dependencies }) -> Promise<aggregateReport>`
- Receipt: `<target>/.context-rail/runtime/setup-receipt.json` with plan ID and per-step `completed|failed|pending` state.

- [ ] **Step 1: Write a dry-run test proving discovery performs no download and changes neither target nor HOME.**
- [ ] **Step 2: Write full new-project, configured-project, and adoption-config fixture tests using fake download/process adapters.**
- [ ] **Step 3: Write reduced-profile and existing-compatible-Throughline tests, including unmanaged installation preservation.**
- [ ] **Step 4: Write failure/resume tests showing completed steps are verified, pending work resumes, and changed preconditions reject the old approval ID.**
- [ ] **Step 5: Run `node --test test/setup-integration.test.mjs` and confirm the missing orchestration behavior.**
- [ ] **Step 6: Implement discovery and compose lower-level plans without duplicating their ownership rules.**
- [ ] **Step 7: Implement apply in the specified order, writing the setup receipt atomically after each completed component and reporting recoverable state on failure.**
- [ ] **Step 8: Implement aggregate readiness with distinct structural, synthetic, and live-evidence fields; return `installed_live_verification_required` when only live evidence is absent.**
- [ ] **Step 9: Run the focused integration test and confirm all scenarios pass.**
- [ ] **Step 10: Commit `feat: orchestrate resumable full setup`.**

### Task 6: CLI setup command and TTY approval

**Files:**
- Modify: `src/cli/main.mjs`
- Create: `test/setup-cli.test.mjs`
- Modify: `bin/contextrail.mjs`

**Interfaces:**
- CLI: `contextrail setup [--target PATH] [--project new|existing] [--adoption-config FILE] [--core-only|--no-context-hooks|--use-existing-throughline] [--dry-run|--apply] [--json]`
- Dependency injection: `{ stdinIsTTY, stdoutIsTTY, confirm(question), home, platform, env, releaseManifest, releaseAdapter }`

- [ ] **Step 1: Write CLI tests for TTY yes/no, non-TTY flagless plan-only, explicit JSON dry-run/apply, existing-project `needs_input`, invalid combinations, and exit codes.**
- [ ] **Step 2: Run `node --test test/setup-cli.test.mjs` and confirm `setup` prints usage or fails.**
- [ ] **Step 3: Add setup usage parsing and inject discovery dependencies so tests never use the real HOME or network.**
- [ ] **Step 4: Render the complete plan before prompting `Apply? [y/N]`; pass its exact ID to apply only on `y` or `yes`.**
- [ ] **Step 5: Ensure flagless non-TTY execution returns the plan without reading stdin and only explicit `--apply` writes in non-TTY mode.**
- [ ] **Step 6: Run `node --test test/setup-cli.test.mjs test/cli.test.mjs` and confirm both pass.**
- [ ] **Step 7: Commit `feat: add interactive setup command`.**

### Task 7: Deterministic release assets and cross-platform packed-artifact CI

**Files:**
- Create: `scripts/build-release.mjs`
- Create: `test/release-assets.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/verify.yml`
- Create: `.github/workflows/release.yml`
- Modify: `.gitignore`

**Interfaces:**
- Script: `node scripts/build-release.mjs --output PATH --throughline-artifact FILE`
- Output: `contextrail-<version>.tgz`, byte-identical `contextrail.tgz`, `throughline-<version>.tgz`, `release-manifest.json`, `SHA256SUMS.txt`

- [ ] **Step 1: Write release-asset tests for required names, stable/versioned byte identity, manifest digest agreement, and checksum ordering.**
- [ ] **Step 2: Run `node --test test/release-assets.test.mjs` and confirm the script is absent.**
- [ ] **Step 3: Implement the release builder with argv process execution, explicit input artifact, temporary staging, and atomic output replacement.**
- [ ] **Step 4: Add `npm run build:release` and keep package `private: true` because npm registry publication is excluded.**
- [ ] **Step 5: Expand verification to an Ubuntu/macOS/Windows matrix that runs `npm test`, packs the source, installs into an isolated prefix, and executes packed CLI setup dry-run with paths containing spaces and Unicode.**
- [ ] **Step 6: Add a tag-triggered release workflow that builds the pinned Throughline patch, runs the matrix-equivalent checks, and publishes only verified prerelease assets with `contents: write`.**
- [ ] **Step 7: Run `node --test test/release-assets.test.mjs`, `npm pack --dry-run`, and workflow YAML/static command checks.**
- [ ] **Step 8: Commit `build: publish full install release assets`.**

### Task 8: README onboarding, Windows pilot, and repository-wide verification

**Files:**
- Modify: `README.md`
- Modify: `integrations/throughline/README.md`
- Create: `docs/reference/WINDOWS_PILOT.md`
- Modify: `docs/reference/README.md`
- Modify: `docs/authority/ARCHITECTURE.md`
- Modify: `docs/authority/INTEGRATIONS.md`
- Modify: `docs/authority/VALIDATION.md`
- Modify: `state/CURRENT.md`
- Modify: `state/PLAN.md`
- Modify: `state/BACKLOG.json`

**Interfaces:**
- Quickstart: `npm install --global https://github.com/jeongyeop91/ContextRail/releases/latest/download/contextrail.tgz` then `contextrail setup`
- Machine flow: `contextrail setup --dry-run --json` then `contextrail setup --apply --json`

- [ ] **Step 1: Add a documentation test that extracts the primary commands and rejects `$PWD`, shell continuations, npm-registry installation, or a required manual Throughline artifact.**
- [ ] **Step 2: Rewrite the README opening around the two-command full default, followed by a compact profile table, existing-project Codex prompt, verification states, recovery, upgrade, and removal.**
- [ ] **Step 3: Add a native Windows PowerShell pilot checklist covering install, dry-run review, apply, Codex restart, capture, restore, handoff, aggregate verification, and evidence recording; label live evidence pending.**
- [ ] **Step 4: Update Active Authority command and integration contracts while keeping every authority file at or below 500 lines and the router at or below 50 lines.**
- [ ] **Step 5: Run `npm test`, `npm run verify`, `npm pack --dry-run`, and `git diff --check`; record exact degraded external states rather than upgrading them to passing.**
- [ ] **Step 6: Build `0.3.0-rc.1` release assets, verify their SHA-256 values, publish the GitHub prerelease, and smoke the public download URL from an isolated prefix.**
- [ ] **Step 7: Mark CR-008 implementation complete only for automated/macOS evidence, archive this plan under `docs/history/plans/`, and keep the Windows live acceptance gate explicitly pending for stable publication.**
- [ ] **Step 8: Commit `docs: publish full installation guide`.**

