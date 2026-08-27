# Integrations

## Boundary

ContextRail owns repository instructions, document routing, state contracts, validation hints, measurements, and reproducible integration planning. Throughline owns its capture pipeline, restore behavior, handoff memory, hooks, monitor, database, and diagnostics.

Core commands remain usable when Throughline is absent. ContextRail never reads or writes the Throughline database directly and never treats injected model context as project authority.

## Throughline provenance

Compatibility uses an immutable upstream commit, a separately hashed patch, the upstream license, and argv-based test commands. The full upstream source is prepared only in a temporary directory and is not vendored.

## Installation boundary

Preparation may clone, patch, test, and pack in a temporary root. Installation requires explicit apply and uses a versioned ContextRail-managed prefix. It does not replace unrelated global packages or edit shell startup files. Receipts and hashes guard selection and rollback.

`throughline install --dry-run` is plan-only. Apply requires an explicit prepared artifact. A release is selected only after package installation, version execution, hook installation, and structured factory diagnostics succeed. The receipt records source, patch, artifact, and before/after configuration hashes.

Rollback refuses to run if live configuration differs from the selected release receipt, restores configuration on a failed transition, and selects only a prior ContextRail-managed release. It does not remove unrelated packages or hooks.

## Readiness

Readiness states are `absent`, `prepared`, `installed`, `hooks_ready`, `capture_verified`, `degraded`, and `incompatible`. Capture verification requires structured evidence of non-empty captured layers; the presence of hook declarations alone is insufficient.

Ordinary verification invokes only the selected binary's version and `factory-diagnostics --json`. Human `doctor --codex` output is an optional read-only passthrough. ContextRail never opens the Throughline database to infer readiness.
