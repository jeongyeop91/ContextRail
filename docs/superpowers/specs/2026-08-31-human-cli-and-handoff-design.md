# Human CLI and one-command handoff design

## Status

Approved direction: keep installation and handoff as separate one-command operations.

## Problem

The full setup is structurally automated, but a person still has to interpret large
JSON plans, raw Throughline diagnostics, managed runtime paths, hashes, and internal
status names. A Windows handoff also required copying a Node executable path, a
managed Throughline path, and an exact session identifier. Deprecated Codex feature
configuration can remain installed even after the canonical feature is available.

The default CLI must answer three human questions without exposing implementation
detail:

1. Did installation or update complete?
2. Is the integration ready, and if not, what must I do next?
3. Did handoff create and open a new Codex task?

## Goals

- Make installation and in-place update a single `contextrail setup` command.
- Make fresh-task memory continuation a single `contextrail handoff` command.
- Add a concise `contextrail doctor` command for human readiness checks.
- Render short, stable human output by default on macOS, Windows, and Linux.
- Put internal evidence behind explicit `--debug` or machine-oriented `--json` modes.
- Migrate deprecated `[features].codex_hooks` configuration to canonical
  `[features].hooks` through the existing plan/apply and receipt boundary.
- Preserve Throughline, unrelated Hooks, Codex trust state, and existing-repository
  authority mappings.

## Non-goals

- `setup` never creates a Codex task or performs a handoff.
- `handoff` never installs, updates, adopts, or rewrites project authority.
- ContextRail does not read or write the Throughline database directly.
- Human output is not a substitute for the stable JSON automation contract.
- Existing repositories still require a reviewed adoption mapping when absent.

## Command contract

### Setup

```text
contextrail setup [existing setup options] [--debug|--json]
```

An interactive invocation discovers whether the target needs a fresh install, an
in-place update, a configuration migration, or verification. It shows a concise
plan, asks once for confirmation, re-plans to protect the apply boundary, applies,
and prints a concise result. Non-interactive writes continue to require `--apply`;
flagless non-TTY setup remains plan-only.

The normal successful result names the target, ContextRail/Throughline state, Hook
state, capture readiness, any completed feature migration, and exactly one next
action. It does not print plan hashes, artifact URLs, absolute managed runtime
paths, raw diagnostics, or nested JSON.

### Handoff

```text
contextrail handoff [--session codex:ID] [--open-host desktop|vscode|cli|auto]
                    [--debug|--json]
```

ContextRail resolves the selected managed Throughline executable and invokes its
fresh-thread handoff command with execution enabled. Session resolution remains a
Throughline concern: an explicit session is forwarded when supplied; otherwise the
current environment and Throughline's normal current-memory selection are used.
ContextRail does not infer a session by opening SQLite or parsing rollout files.

The default open host is `auto` because a standalone terminal cannot reliably know
whether the user intends Desktop, VS Code, or CLI. Codex-hosted callers should pass
their known host explicitly. The result must report the source session, new task ID,
memory injection state, and whether the host opened. It must also report a manual
resume command only when opening failed.

### Doctor

```text
contextrail doctor [--debug|--json]
```

Doctor aggregates ContextRail project state, managed Throughline readiness, Hook
registration and trust, capture evidence, and handoff readiness. A normal result is
a short checklist. A degraded result leads with the failed component and gives one
specific corrective action.

The existing lower-level `throughline`, `hooks`, and `automation` commands remain
available for compatibility and advanced recovery.

## Output modes

### Human mode (default)

Human mode uses short Korean-neutral labels that can be localized later without
changing status codes. It contains no nested object dump. Example:

```text
ContextRail setup complete
  Project: ready
  Throughline: ready (0.10.3-codex.3)
  Codex Hooks: trusted
  Capture: ready
  Codex config: migrated to features.hooks

Next: contextrail handoff
```

Failures use a summary, cause, and next action:

```text
ContextRail setup needs attention
  Cause: Codex Hooks are not trusted
  Next: approve the listed Hooks in Codex, then run contextrail doctor
```

### JSON mode

`--json` is the stable machine-readable contract. It emits one JSON document to
stdout and no human prose. Existing automation fields remain compatible; new
high-level commands add versioned result schemas.

### Debug mode

`--debug` keeps the human summary and appends implementation evidence: plan IDs,
hashes, resolved executables, subprocess argv, raw stdout/stderr, upstream
diagnostics, and error stacks. Sensitive environment values and credentials are
never printed. `--debug` and `--json` are mutually exclusive so each stream has one
clear consumer.

Node experimental warnings and unrelated connector failures are suppressed from
normal output and classified in debug output. A warning that changes the requested
operation's result remains visible in human mode.

## Codex feature migration

Planning normalizes only the `[features]` entries for `codex_hooks` and `hooks`:

- legacy-only `codex_hooks = true` becomes `hooks = true`;
- legacy-only `codex_hooks = false` becomes `hooks = true` for installation, while
  uninstall preserves the prior disabled semantics as canonical `hooks = false`;
- when both keys exist, canonical `hooks` determines the pre-install state and the
  legacy line is removed;
- comments, all other config sections, Hook trust state, and unrelated feature keys
  remain byte-preserved.

The deprecated spelling is not restored during uninstall. The receipt records the
migration separately from a ContextRail-owned enable edit so repeat setup can
refresh trust-state hashes without treating Codex's persisted approvals as a
concurrent change. A configured rc.9 target plans the migration during its next
`setup` run rather than requiring manual config editing.

## Architecture

Human rendering is a separate pure CLI presentation module. Core and integration
layers continue returning structured domain results; they do not write terminal
prose. Setup, handoff, and doctor select one renderer based on `human`, `json`, or
`debug` mode.

The handoff adapter resolves the managed Throughline invocation through the existing
managed-release receipt, passes argv as an array, requests upstream JSON internally,
and maps it to a ContextRail result. Raw upstream output is retained only for debug
rendering.

## Safety and error handling

- Setup preserves plan-first writes and exact plan identity confirmation.
- Handoff creates a fresh task and never mutates the current task.
- No command silently falls back to rollout files or a different memory source.
- Ambiguous or missing memory returns a concise failure instead of guessing.
- A host-open failure still reports whether the new task and memory injection
  succeeded, together with the manual resume command.
- Debug output redacts credentials and token-shaped environment values.

## Validation

Tests are written before behavior changes and cover:

- legacy-only and dual-key feature migration, repeat setup, uninstall semantics,
  trust-state preservation, and concurrent user changes;
- concise setup planned/success/needs-input/failure rendering;
- managed one-command handoff argv, successful task creation, open failure, missing
  memory, and raw-output suppression;
- concise doctor ready/degraded rendering;
- `--debug` evidence, redaction, and `--debug`/`--json` exclusion;
- unchanged JSON automation behavior;
- packed CLI smoke on Ubuntu, macOS, and Windows.

Targeted tests run first, followed by `npm test` and `npm run verify`. Native Windows
acceptance confirms that one `setup` command removes the deprecation warning and one
`handoff` command creates, injects, and opens a new Codex Desktop task.
