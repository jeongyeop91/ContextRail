# Throughline compatibility integration

This directory contains no vendored Throughline source. It stores an immutable upstream base, a separately hashed compatibility patch, the upstream MIT license, and the tests needed to prepare an installable artifact in a temporary directory.

`source.json` is the execution contract. Preparation checks out only the pinned base, verifies HEAD, checks and applies the patch, runs focused and upstream tests, then creates an npm tarball. A dry run prints this plan without cloning or writing HOME.

Throughline remains optional. ContextRail core validation, routing, continuation, scaffolding, and measurement do not import or invoke it.

The patch may be removed only after an immutable upstream release contains equivalent current Codex rollout support and the same capture verification passes.

## Managed installation

`contextrail throughline install --dry-run` reports the planned versioned release without preparing or installing it. `--apply` additionally requires the exact prepared tarball. ContextRail installs beneath its own managed data root, runs the packaged binary against the selected HOME, preserves unrelated hook entries, writes a receipt, and switches `current.json` only after verification.

`contextrail throughline verify --json` is read-only. A registered hook can reach `hooks_ready`, but `capture_verified` additionally needs non-zero captured body and detail counts plus structured injected-context exclusion evidence.

Rollback is explicit and receipt-guarded. It refuses concurrent configuration changes and only transitions between ContextRail-managed releases.
