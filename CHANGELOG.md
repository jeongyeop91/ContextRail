# Changelog

All notable changes to ContextRail are documented here.

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
