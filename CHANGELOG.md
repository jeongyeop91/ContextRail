# Changelog

All notable changes to ContextRail are documented here.

## 0.3.0 - 2026-09-03

### Added

- Publish the first stable cross-platform full setup for new and existing
  projects with managed Throughline and guarded Codex Hooks.

### Validated

- Complete the native Windows existing-project pilot for installation, Hook
  trust, automatic capture, semantic handoff, and option-free Desktop opening.

## 0.3.0-rc.13 - 2026-09-03

### Changed

- Make Codex Desktop the default host for option-free `contextrail handoff`,
  while preserving explicit VS Code, CLI, and automatic host selection.
- Split the README onboarding into complete new-project and existing-project
  how-to guides, including reviewed existing-repository adoption and full setup.

## 0.3.0-rc.12 - 2026-09-01

### Fixed

- Compare Codex Hook approval hashes with the current normalized Hook
  definitions instead of treating any stored hash as trusted.
- Report release-path Hook changes as requiring review in the Codex Hooks menu,
  and keep Throughline factory diagnostics degraded until review is complete.
- Give `contextrail doctor` a direct Hook-review action for this state instead
  of the generic automatic-capture troubleshooting message.

## 0.3.0-rc.11 - 2026-09-01

### Fixed

- Make default fresh-task handoff records project-neutral instead of injecting
  Throughline development constraints into unrelated repositories.
- Preserve the source session's recent L2 memory while using a generic
  `continue the current task` intent and no fabricated default constraints.

## 0.3.0-rc.10 - 2026-08-31

### Added

- Add concise human `doctor` output that distinguishes Codex Hook registration, ContextRail Stop dispatch, and Throughline capture evidence.
- Add one-command `contextrail handoff` for managed Throughline fresh-task creation, memory injection, and host opening.
- Record a bounded, content-free Stop-dispatch marker under Git-ignored project runtime state.

### Changed

- Make flagless `setup`, `doctor`, and `handoff` output concise for people while retaining `--json` for automation and a separate redacted `--debug` mode.
- Migrate deprecated Codex `[features].codex_hooks` configuration to canonical `[features].hooks` without restoring the legacy key on uninstall.

## 0.3.0-rc.9 - 2026-08-28

### Fixed

- Resolve the Codex CLI bundled or cached by Codex Desktop on Windows and macOS before falling back to `PATH`, so Throughline app-server handoff no longer requires a separately installed global `codex` command.
- Prefer an executable `CODEX_CLI_PATH` and support both direct and release-hash user-local Windows Codex layouts without scanning the protected `WindowsApps` package.

## 0.3.0-rc.8 - 2026-08-28

### Fixed

- Retry transient Windows `EPERM`, `EBUSY`, and `EACCES` failures while atomically replacing the resumable setup progress receipt, without deleting the current receipt.
- Attribute a progress-receipt write failure to the setup step that was actually running and preserve the original structured failure if recording that failure also fails.

## 0.3.0-rc.7 - 2026-08-28

### Fixed

- Refresh the ContextRail Hook receipt after a non-owned Throughline or user Hook changes while continuing to reject missing, duplicate, or modified ContextRail-owned handlers.
- Resume a setup whose managed Throughline step completed before the ContextRail Hook receipt became stale, updating only the receipt and leaving live Hook and Codex config files untouched.

## 0.3.0-rc.6 - 2026-08-28

### Fixed

- Allow a managed Throughline upgrade to replace its own previous Codex Hook commands while continuing to reject changes to ContextRail or user-owned Hook entries.
- Roll back the Codex Hook file and incomplete managed release when an upgrade changes an unrelated Hook.

## 0.3.0-rc.5 - 2026-08-28

### Fixed

- Treat Codex Hook trust state written after user approval as a valid external `config.toml` change when ContextRail did not edit that file, while still rejecting a disabled Hook feature or changes to receipt-owned Hook entries.
- Preserve the approved Codex trust state during repeated setup and ContextRail Hook removal instead of reporting `CODEX_HOOK_CONCURRENT_CHANGE`.

## 0.3.0-rc.4 - 2026-08-28

### Fixed

- Recognize Codex Hook trust state written as TOML literal-string keys on Windows, so approved managed Hooks no longer report the false diagnostic `0/3 trusted`.
- Ship the fix as the reproducibly patched managed Throughline `0.10.3-codex.2` artifact and cover it with the upstream doctor regression suite.

## 0.3.0-rc.3 - 2026-08-28

### Fixed

- Resolve the selected ContextRail-managed Throughline executable for standalone verification and Codex doctor diagnostics instead of requiring a global `throughline` command on `PATH`.
- Document Hook trust approval and in-place candidate updates for the native Windows existing-project pilot.

## 0.2.0 - 2026-08-27

### Added

- Opt-in Codex `UserPromptSubmit` routing and continuation context.
- Non-blocking Codex `Stop` document and state checks.
- Plan-first user Hook install, verification, and uninstall with preservation receipts.
- Ownership-guarded per-project Codex automation enable and disable commands.

### Safety

- Bounded Hook output that never echoes the raw prompt or executes validation hints.
- Temporary-HOME lifecycle tests, transactional rollback, duplicate detection, and concurrent-change guards.
- Explicit separation between ContextRail context handlers and Throughline capture handlers.

## 0.1.0 - 2026-08-27

### Added

- Hierarchical `AGENTS.md` routing and bounded documentation authority.
- Native file memory with current state, one active plan, backlog, and ADRs.
- Plan-first `init`, `adopt`, and hash-guarded `upgrade` commands.
- Existing-repository adoption with recursive authority roots and references state mode.
- Deterministic `check`, `route`, and `continue` commands.
- Local provenance-labelled measurements.
- Optional, separately managed Throughline preparation, installation, verification, and rollback.
- Installable CLI package with `--version` and `--help`.

### Safety

- Repository-relative path confinement and structured argv validation.
- Conflict-first preservation of existing and user-owned files.
- Read-only ordinary checks and explicit apply boundaries.

[0.1.0]: https://github.com/jeongyeop91/ContextRail/releases/tag/v0.1.0
[0.2.0]: https://github.com/jeongyeop91/ContextRail/releases/tag/v0.2.0
