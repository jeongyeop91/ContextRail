# Validation

## Layers

1. Targeted tests cover the changed behavior or document contract.
2. `contextrail check` validates document governance and project memory offline.
3. `npm test` runs deterministic repository tests.
4. Generated-project smoke tests prove the template validates after creation.
5. Optional live integration checks report host state without changing it.
6. Packed-artifact setup smoke runs on Ubuntu, macOS, and Windows CI with spaces and non-ASCII paths.
7. Release verification binds npm and GitHub ContextRail tarballs, the embedded setup manifest, the detached envelope, checksums, and the separate Throughline artifact.

## Result contract

Validation returns stable issues shaped as `code`, `path`, `message`, and `severity`. Issues are sorted for reproducibility. CLI exit codes are:

- `0`: requested operation succeeded.
- `1`: repository contract violations were found.
- `2`: invalid CLI usage or configuration.
- `3`: an external integration failed or is incompatible.

## Evidence

Claims must name the command and observed result. A dry run proves planning, not installation. Registered hooks prove configuration, not dispatch or captured content. A recent ContextRail Stop marker proves dispatch of that handler, not Throughline capture. Capture requires separate structured evidence from the Throughline-owned boundary. Estimated measurements remain separate from host- or tool-reported values.

External state may be `degraded` while core validation passes. Never coerce a missing or legacy integration into a successful state.

`installed_live_verification_required` means structural installation and synthetic behavior passed while live ContextRail consumption or Throughline capture, restore, and handoff remain unverified. Windows CI is executable evidence but does not satisfy the native Windows Codex pilot. npm `latest` promotion remains blocked until that pilot is recorded.

Human command output is a bounded summary, not an archival evidence format. `--json` is the automation contract. `--debug` is mutually exclusive with JSON and may include local paths or redacted upstream diagnostics; it must be reviewed before sharing.
