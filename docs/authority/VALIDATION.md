# Validation

## Layers

1. Targeted tests cover the changed behavior or document contract.
2. `contextrail check` validates document governance and project memory offline.
3. `npm test` runs deterministic repository tests.
4. Generated-project smoke tests prove the template validates after creation.
5. Optional live integration checks report host state without changing it.

## Result contract

Validation returns stable issues shaped as `code`, `path`, `message`, and `severity`. Issues are sorted for reproducibility. CLI exit codes are:

- `0`: requested operation succeeded.
- `1`: repository contract violations were found.
- `2`: invalid CLI usage or configuration.
- `3`: an external integration failed or is incompatible.

## Evidence

Claims must name the command and observed result. A dry run proves planning, not installation. Registered hooks prove configuration, not captured content. Estimated measurements remain separate from host- or tool-reported values.

External state may be `degraded` while core validation passes. Never coerce a missing or legacy integration into a successful state.
