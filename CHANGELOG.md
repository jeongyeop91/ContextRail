# Changelog

All notable changes to ContextRail are documented here.

## Unreleased

- No changes yet.

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
