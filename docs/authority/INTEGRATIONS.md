# Integrations

## Boundary

ContextRail owns repository instructions, document routing, state contracts, validation hints, measurements, and reproducible integration planning. Throughline owns its capture pipeline, restore behavior, handoff memory, hooks, monitor, database, and diagnostics.

Core commands remain usable when Throughline is absent. ContextRail never reads or writes the Throughline database directly and never treats injected model context as project authority.

## Throughline provenance

Compatibility uses an immutable upstream commit, a separately hashed patch, the upstream license, and argv-based test commands. The full upstream source is prepared only in a temporary directory and is not vendored.

## Installation boundary

Preparation may clone, patch, test, and pack in a temporary root. Installation requires explicit apply and uses a versioned ContextRail-managed prefix. It does not replace unrelated global packages or edit shell startup files. Receipts and hashes guard selection and rollback.

## Readiness

Readiness states are `absent`, `prepared`, `installed`, `hooks_ready`, `capture_verified`, `degraded`, and `incompatible`. Capture verification requires structured evidence of non-empty captured layers; the presence of hook declarations alone is insufficient.
