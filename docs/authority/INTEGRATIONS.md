# Integrations

## Boundary

ContextRail owns repository instructions, document routing, state contracts, validation hints, measurements, its bounded Codex context handlers, and reproducible integration planning. Throughline owns its capture pipeline, restore behavior, handoff memory, capture hooks, monitor, database, and diagnostics.

Core commands remain usable when Throughline is absent. ContextRail never reads or writes the Throughline database directly and never treats injected model context as project authority.

ContextRail and Throughline may both register Codex Hooks. ContextRail appends only its exact `UserPromptSubmit` and `Stop` groups, preserves existing ordering and non-owned groups, and uses a separate receipt. It does not call, edit, verify, or uninstall Throughline handlers. ContextRail route/continue context is ephemeral guidance; Throughline capture and handoff remain independent memory concerns.

## Codex Hook registration

Global handler registration is inert for repositories whose `automation.codex.enabled` is not true. Install, feature-flag editing, project opt-in, and uninstall are separate plan/apply operations. User-level apply writes its receipt last and uses before/after hashes; project apply updates only ContextRail-owned metadata. Any concurrent change produces a conflict.

Verification may prove registration and isolated handler behavior, but not consumption by a live Codex conversation. Trust approval, host reload, and live context observation remain manual host-level evidence.

## Throughline provenance

Compatibility uses an immutable upstream commit, a separately hashed patch, the upstream license, and argv-based test commands. The full upstream source is prepared only in a temporary directory and is not vendored.

## Installation boundary

Preparation may clone, patch, test, and pack in a temporary root. Installation requires explicit apply and uses a versioned ContextRail-managed prefix. It does not replace unrelated global packages or edit shell startup files. Receipts and hashes guard selection and rollback.

The full `setup` profile reads the embedded `integrations/setup-manifest.json`, downloads only its immutable GitHub Release Throughline asset, verifies SHA-256, and then uses this managed installation boundary. The detached `release-manifest.json` binds the final ContextRail tarball, embedded setup-manifest bytes, checksum file, and Throughline asset without placing a self-digest inside the ContextRail tarball.

Managed data follows native conventions: Application Support on macOS, XDG data on Linux, and LocalAppData on Windows. Installed Throughline JavaScript is invoked through the selected absolute Node executable and resolved package `bin` entry. ContextRail does not depend on POSIX `.bin` shims or Windows `.cmd` wrappers. WSL is Linux and cannot silently configure a mounted Windows-native Codex home.

`throughline install --dry-run` is plan-only. Apply requires an explicit prepared artifact. A release is selected only after package installation, version execution, hook installation, and structured factory diagnostics succeed. The receipt records source, patch, artifact, and before/after configuration hashes.

Rollback refuses to run if live configuration differs from the selected release receipt, restores configuration on a failed transition, and selects only a prior ContextRail-managed release. It does not remove unrelated packages or hooks.

Setup records component completion after each owned boundary. A failure distinguishes completed, failed, and pending components. Repeated apply verifies a selected managed release and exact ContextRail receipts before resuming; it never replaces an unmanaged Throughline installation.

## Readiness

Readiness states are `absent`, `prepared`, `installed`, `hooks_ready`, `capture_verified`, `degraded`, and `incompatible`. Capture verification requires structured evidence of non-empty captured layers; the presence of hook declarations alone is insufficient.

Ordinary verification invokes only the selected binary's version and `factory-diagnostics --json`. Human `doctor --codex` output is an optional read-only passthrough. ContextRail never opens the Throughline database to infer readiness.
