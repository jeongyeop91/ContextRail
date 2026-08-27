# Cross-platform Full Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an npm- and GitHub Release-distributed `contextrail setup` that safely configures ContextRail Core, the pinned Codex-compatible Throughline, ContextRail Codex Hooks, and project automation on macOS, Linux, and native Windows.

**Architecture:** A pure setup planner classifies the project and composes existing component plans into a hash-identified setup plan. Effectful adapters download and verify release assets, resolve native data paths and JavaScript package entry points, and apply the approved steps through their existing ownership boundaries; a receipt records resumable progress without claiming a cross-filesystem transaction. The CLI provides interactive confirmation only on a TTY, while `--dry-run` and `--apply` remain the machine-readable boundaries.

**Tech Stack:** Node.js 22.13+ standard library, `node:test`, GitHub Actions, npm package tarballs, GitHub Releases.

**Spec:** `docs/adr/0003-cross-platform-full-install.md`, `docs/adr/0004-interactive-quickstart.md`, `docs/adr/0005-npm-registry-distribution.md`, `docs/adr/0006-detached-release-envelope.md`, `docs/superpowers/specs/2026-08-27-npm-registry-distribution-design.md`

## Global Constraints

- Core operation must not require Throughline, a network, or a global package.
- Write-capable commands plan first and require either an affirmative TTY confirmation or explicit `--apply`.
- Supported platforms are `darwin`, `linux`, and native `win32`; WSL is a separate Linux environment.
- Runtime processes use executable-plus-argv arrays and never depend on a POSIX shell.
- Release downloads are selected by an embedded manifest and SHA-256 verified before installation.
- Existing repositories require an explicit adoption config; setup never guesses semantic mappings.
- Unmanaged Throughline installations are preserved and never overwritten.
- Windows live Codex evidence remains pending until the user completes the supplied pilot checklist.
- The retained `v0.3.0-rc.1` tag failed before release publication because platform-specific gzip headers changed the Throughline artifact digest. Publication continues with canonically normalized `0.3.0-rc.2` under `next`; `0.3.0` receives `latest` only after recorded Windows live evidence.
- npm and GitHub Release ContextRail tarballs are byte-identical, while Throughline remains a separate verified GitHub asset.
- Automated npm publication uses GitHub Actions OIDC Trusted Publishing and no long-lived registry token.

---

## File Structure

- `src/core/setup.mjs`: pure project classification, option validation, component ordering, plan identity, and resumable state decisions.
- `src/adapters/platform.mjs`: native managed-data roots, WSL/native-host checks, and JavaScript package-bin resolution.
- `src/adapters/release.mjs`: HTTPS download to a temporary directory and streaming SHA-256 verification.
- `src/integrations/setup-manifest.mjs`: embedded Throughline selection-manifest validation.
- `src/integrations/release-manifest.mjs`: detached release-envelope validation and artifact verification.
- `src/integrations/setup.mjs`: effectful discovery, component plan composition, apply/resume orchestration, and aggregate verification.
- `src/integrations/codex-hooks.mjs`: portable `command` plus `commandWindows` Hook entries.
- `src/integrations/throughline-install.mjs`: direct Node invocation of the installed Throughline JavaScript bin.
- `src/cli/main.mjs`: setup arguments, TTY confirmation, JSON output, and exit codes.
- `scripts/build-release.mjs`: deterministic ContextRail alias/versioned assets, patched Throughline artifact, manifest, and checksum generation.
- `.github/workflows/verify.yml`: packed-artifact setup matrix on Ubuntu, macOS, and Windows.
- `.github/workflows/release.yml`: verified GitHub Release asset publication from a version tag.
- `.github/workflows/publish.yml`: tag/version-gated npm publication of the already verified tarball through OIDC.
- `test/setup*.test.mjs`, `test/platform.test.mjs`, `test/release-manifest.test.mjs`: focused deterministic coverage.
- `README.md`, `docs/reference/WINDOWS_PILOT.md`, `integrations/throughline/README.md`: two-command onboarding, mode selection, recovery, and honest live validation.

### Task 1: Release manifest and verified artifact download

**Files:**
- Create: `src/integrations/setup-manifest.mjs`
- Create: `src/integrations/release-manifest.mjs`
- Create: `src/adapters/release.mjs`
- Create: `integrations/setup-manifest.json`
- Create: `test/setup-manifest.test.mjs`
- Create: `test/release-manifest.test.mjs`
- Create: `test/release-download.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateSetupManifest(value) -> { ok, issues, manifest? }`
- Produces: `loadSetupManifest({ root, fs }) -> Promise<{ ok, issues, manifest? }>`
- Produces: `selectThroughlineArtifact(manifest) -> { name, url, sha256 }`
- Produces: `validateReleaseManifest(value) -> { ok, issues, manifest? }` for the detached envelope
- Produces: `downloadVerifiedArtifact({ artifact, destination, http, fs }) -> Promise<{ path, sha256, bytes }>`

- [ ] **Step 1: Write embedded setup-manifest tests that reject mutable URLs, unknown platforms, malformed digests, and mismatched package/runtime metadata.**

```js
const result = validateReleaseManifest({ ...validManifest, artifacts: [{ name: 'throughline', url: 'https://example.invalid/latest/x.tgz', sha256: 'bad' }] });
assert.equal(result.ok, false);
assert.deepEqual(result.issues.map(({ code }) => code), ['MUTABLE_RELEASE_ARTIFACT_URL', 'INVALID_RELEASE_ARTIFACT_SHA256']);
```

- [ ] **Step 2: Run `node --test test/setup-manifest.test.mjs` and confirm the missing module failure.**
- [ ] **Step 3: Implement strict setup-manifest validation and embed only the immutable Throughline selection and provenance; do not include a ContextRail self-digest.**

```js
export function selectThroughlineArtifact(manifest) {
  return structuredClone(manifest.throughline.artifact);
}
```

- [ ] **Step 4: Write detached-envelope tests that bind the ContextRail tarball digest, embedded setup-manifest digest, Throughline digest, and checksum identity without self-reference.**
- [ ] **Step 5: Write download tests with an injected HTTPS adapter, including digest rejection and cleanup of the partial file.**
- [ ] **Step 6: Implement streamed download and SHA-256 verification without following a redirect outside `github.com` or `objects.githubusercontent.com`.**
- [ ] **Step 7: Run `node --test test/setup-manifest.test.mjs test/release-manifest.test.mjs test/release-download.test.mjs` and confirm all tests pass.**
- [ ] **Step 8: Commit `feat: add verified release artifacts`.**

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
- Create: `.github/workflows/publish.yml`
- Modify: `.gitignore`

**Interfaces:**
- Script: `node scripts/build-release.mjs --output PATH --throughline-artifact FILE`
- Output: `contextrail-<version>.tgz`, byte-identical `contextrail.tgz`, `throughline-<version>.tgz`, `release-manifest.json`, `SHA256SUMS.txt`

- [ ] **Step 1: Write release-asset tests for required names, stable/versioned byte identity, manifest digest agreement, and checksum ordering.**
- [ ] **Step 2: Run `node --test test/release-assets.test.mjs` and confirm the script is absent.**
- [ ] **Step 3: Implement the release builder with argv process execution, explicit input artifact, temporary staging, atomic output replacement, and detached-envelope generation only after the ContextRail tarball is final.**
- [ ] **Step 4: Add `npm run build:release`, remove `private: true`, and set `publishConfig.access` to `public` without a permanent dist-tag.**
- [ ] **Step 5: Expand verification to an Ubuntu/macOS/Windows matrix that runs `npm test`, packs the source, installs into an isolated prefix, and executes packed CLI setup dry-run with paths containing spaces and Unicode.**
- [ ] **Step 6: Add a tag-triggered GitHub release workflow that builds the pinned Throughline patch, runs the matrix-equivalent checks, and publishes only verified assets with `contents: write`.**
- [ ] **Step 7: Add an npm publish workflow using Node.js 24, `id-token: write`, `contents: read`, disabled release caching, exact tag/package version validation, prerelease-to-`next` and stable-to-`latest` selection, and publication of the previously packed tarball.**

```yaml
permissions:
  contents: read
  id-token: write
```

- [ ] **Step 8: Run `node --test test/release-assets.test.mjs`, `npm pack --dry-run --json`, `npm publish --dry-run --access public --tag next`, and workflow YAML/static command checks.**
- [ ] **Step 9: Commit `build: publish full install release assets`.**

### Task 8: README onboarding and Windows pilot documentation

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
- Release-candidate quickstart: `npm install --global contextrail@next` then `contextrail setup`
- Stable quickstart after Windows acceptance: `npm install --global contextrail` then `contextrail setup`
- Audited fallback: install the immutable versioned GitHub Release tarball, then run the same setup command.
- Machine flow: `contextrail setup --dry-run --json` then `contextrail setup --apply --json`

- [ ] **Step 1: Add a documentation test that extracts the primary commands and rejects `$PWD`, shell continuations, a required manual Throughline artifact, or an unqualified npm stable command before the Windows acceptance record exists.**
- [ ] **Step 2: Rewrite the README opening around the `@next` two-command release-candidate default and immutable GitHub fallback, followed by a compact profile table, existing-project Codex prompt, verification states, recovery, upgrade, and removal.**
- [ ] **Step 3: Add a native Windows PowerShell pilot checklist covering install, dry-run review, apply, Codex restart, capture, restore, handoff, aggregate verification, and evidence recording; label live evidence pending.**
- [ ] **Step 4: Update Active Authority command and integration contracts while keeping every authority file at or below 500 lines and the router at or below 50 lines.**
- [ ] **Step 5: Run documentation tests and `node bin/contextrail.mjs check --json`; keep live states explicitly unverified.**
- [ ] **Step 6: Commit `docs: publish full installation guide`.**

### Task 9: npm first-publication bootstrap and public artifact verification

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/reference/README.md`
- Create: `docs/history/releases/2026-08-27-v0.3.0-rc.2.md`

**Interfaces:**
- Manual bootstrap: `npm publish contextrail-0.3.0-rc.2.tgz --access public --tag next`
- Registry checks: `npm view contextrail@0.3.0-rc.2 version dist.tarball dist.integrity dist-tags --json`
- Candidate install: `npm install --global contextrail@next`

- [ ] **Step 1: Set the package and CLI version to `0.3.0-rc.2`, then run the focused release-version test and confirm it initially fails before updating generated metadata.**
- [ ] **Step 2: Build the patched Throughline and complete release assets once; verify the ContextRail versioned asset, stable-name asset, and npm input tarball have the same SHA-256.**
- [ ] **Step 3: Run `npm test`, `npm run verify`, `npm pack --dry-run --json`, `npm publish --dry-run --access public --tag next`, and isolated tarball version/help/init/setup smoke.**
- [ ] **Step 4: Publish the GitHub `v0.3.0-rc.2` prerelease with manifest, checksum, ContextRail, and Throughline assets, then re-download and verify every digest.**
- [ ] **Step 5: Confirm `npm view contextrail` still returns not-found, then perform the one-time 2FA publication of the exact verified tarball using `--tag next`; never place an OTP in a file, command history, log, or project state.**
- [ ] **Step 6: Verify public owners, version, `next` dist-tag, registry integrity, unpacked allowlist, and a clean global install from `contextrail@next`; confirm `latest` is absent.**
- [ ] **Step 7: Configure the npm Trusted Publisher for the public repository, workflow filename `publish.yml`, and allowed `npm publish`; verify OIDC on the next real prerelease rather than publishing a throwaway version.**
- [ ] **Step 8: Record immutable release digests and automated evidence without credentials, personal paths, prompts, or runtime metrics.**
- [ ] **Step 9: Commit `docs: record v0.3.0 release candidate`.**

### Task 10: Repository-wide handoff and stable promotion gate

**Files:**
- Modify: `state/CURRENT.md`
- Modify: `state/PLAN.md`
- Modify: `state/BACKLOG.json`
- Move: `docs/superpowers/plans/2026-08-27-cross-platform-full-install.md` to `docs/history/plans/2026-08-27-cross-platform-full-install.md` after automated completion

**Interfaces:**
- Windows evidence input: `docs/reference/WINDOWS_PILOT.md` completed by the user on native Windows.
- Stable promotion output: `contextrail@0.3.0` under `latest` only after that evidence is accepted.

- [ ] **Step 1: Run `npm test`, `npm run verify`, `npm pack --dry-run --json`, public npm candidate smoke, public GitHub fallback smoke, and `git diff --check`.**
- [ ] **Step 2: Update CURRENT with exact Ubuntu/macOS/Windows CI evidence and label Windows live Codex capture, restore, and handoff as pending.**
- [ ] **Step 3: Mark implementation tasks complete and archive the plan, but keep stable npm promotion as a blocked acceptance gate rather than claiming Windows live readiness.**
- [ ] **Step 4: After the user supplies passing Windows evidence, tag and verify `0.3.0`, publish the exact tarball through Trusted Publishing under `latest`, move the README from `@next` to the unqualified command, and record the stable digests.**
- [ ] **Step 5: Commit `chore: complete cross-platform distribution`.**
