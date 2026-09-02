# ContextRail Architecture

## Status

- Classification: Active Authority
- Approved: 2026-08-27
- Scope: ContextRail MVP and optional Throughline integration

## Purpose

ContextRail is a reusable, product-neutral project operations foundation for coding agents. It routes an agent to the smallest relevant context, keeps project truth in explicit files, validates documentation and continuity contracts, and measures context use without requiring a hosted service.

The default work loop is:

```text
search -> locate -> bounded read -> modify -> targeted validation
```

ContextRail is independent of programming language, framework, model provider, and agent host. The implementation runtime is Node.js 22.13 or newer and uses only Node.js standard-library modules in the MVP.

## Product Boundaries

ContextRail owns:

- project-local `AGENTS.md` hierarchy and instruction routing;
- the short document index and document classifications;
- current state, active plan, backlog, and ADR contracts;
- bootstrap, adoption, upgrade planning, and structural validation;
- deterministic `route` and `continue` projections;
- local, provenance-labelled context measurements;
- optional integration adapters and their verification reports.

ContextRail does not own:

- an agent runtime, model router, transcript store, vector database, or RAG service;
- source-code indexing beyond filesystem and text-search guidance;
- automatic branch, worktree, or subagent orchestration;
- Throughline databases, capture hooks, migrations, capture contracts, or handoff semantics;
- global host configuration unless the user explicitly executes an integration install command.

## Architecture

Dependencies point inward:

```text
CLI -> core use cases -> ports <- filesystem, Git, process, Throughline adapters
```

Core modules accept plain values and return structured results. They do not read the real filesystem or start processes directly. Adapters perform I/O and are injected by the CLI. Tests use temporary directories and fake process adapters.

The CLI uses these exit codes:

- `0`: success;
- `1`: project contract violations;
- `2`: invalid arguments or configuration;
- `3`: external tool or integration failure.

## Commands

The MVP command surface is:

```text
contextrail --version|--help
contextrail setup [--target PATH] [--project new|existing] [--adoption-config FILE]
                  [--core-only|--no-context-hooks|--use-existing-throughline]
                  [--dry-run|--apply] [--debug|--json]
contextrail doctor [--target PATH] [--debug|--json]
contextrail handoff [--session codex:ID] [--open-host desktop|vscode|cli|auto]
                    [--debug|--json]
contextrail init [--target PATH] [--dry-run]
contextrail adopt [--target PATH] [--dry-run]
contextrail adopt --profile existing-repository --adoption-config FILE [--dry-run|--apply]
contextrail upgrade [--target PATH] [--dry-run]
contextrail check [--target PATH] [--json]
contextrail route PATH [--target PATH] [--json]
contextrail continue [--target PATH] [--json]
contextrail measure record [options]
contextrail measure report [--target PATH] [--json]
contextrail throughline prepare [--dry-run]
contextrail throughline verify [--live]
contextrail throughline install --dry-run
contextrail throughline install --apply
contextrail throughline rollback
contextrail hooks install --host codex --dry-run|--apply
contextrail hooks verify --host codex
contextrail hooks uninstall --host codex --dry-run|--apply
contextrail automation enable|disable --host codex --target PATH --dry-run|--apply
```

Commands that may write default to a plan-only dry run where the command contract specifies it. Existing files are never overwritten silently. Paths are normalized and confined to the selected target. Writes use a sibling temporary file followed by atomic rename.

`setup` composes the lower-level ownership boundaries. A TTY invocation displays a concise human plan and asks for confirmation; a flagless non-TTY invocation is plan-only, and non-interactive writes require `--apply`. The full profile installs or verifies Throughline, initializes or adopts the project, appends ContextRail Hooks, enables only that project, and aggregates structural versus live readiness. Reduced profiles keep Core independent and explicit. `--json` exposes the stable machine contract; mutually exclusive `--debug` appends bounded troubleshooting evidence and may expose local paths.

`doctor` presents project, managed Throughline, Codex Hook registration/trust, recent ContextRail Stop dispatch, and automatic capture as separate components. `handoff` resolves the selected managed Throughline release and invokes its fresh-task start boundary through executable-plus-argv, without mutating the current task. Codex Desktop is the default handoff host; `--open-host` explicitly selects VS Code, CLI, or automatic host resolution when needed. An omitted session delegates latest-source selection to Throughline; ContextRail does not inspect its database or rollout files to guess one.

## Project Memory

ContextRail supports two memory modes. Native mode owns the neutral scaffold contracts below. Reference mode maps a mature repository's existing files and treats their project-specific formats as authoritative without copying, converting, or parsing the backlog:

- `state/CURRENT.md`: current objective, completed facts, important files, validation, blockers, limitations, and next action;
- `state/PLAN.md`: the single approved active execution plan;
- `state/BACKLOG.json`: future work, status, priority, dependencies, acceptance, authority references, and validation commands;
- `docs/adr/`: accepted or superseded decisions and their rationale;
- `docs/authority/`: current product and operating contracts;
- `docs/history/`: completed plans and historical evidence;
- `docs/generated/`: reproducible, non-authoritative generated output;
- `docs/reference/`: external and supporting reference material.

Raw conversations, complete logs, tool dumps, and transcripts are not project memory.

An existing-repository mapping uses recursive `authority.roots`, file-or-directory `authority.exclude`, and `state.mode: references`. ContextRail owns only its normalized config, version/ownership manifest, and local runtime ignore file. The mapped `AGENTS.md`, router, authority, status, plan directory, backlog, and root ignore file remain user-owned. Upgrade may change a managed metadata file only when its current hash matches the previously recorded owned hash.

## Documentation Governance

`docs/README.md` is the routing entry point and must not exceed 50 lines. Every Markdown document under `docs/authority/` is Active Authority, must be indexed there, and must not exceed 500 lines. Large authority documents split by cohesive topic.

The validator checks:

- required files and classification directories;
- index registration and line limits;
- relative file links and Markdown heading anchors;
- duplicate current-state or active-plan files;
- backlog identifiers, statuses, dependencies, and current-item references;
- ADR naming, status, and decision date;
- nested instruction scope metadata and instruction-chain size;
- paths that escape the project root;
- unresolved template markers, representative secret patterns, and absolute personal paths.

External links are not fetched by the default offline validator.

## Codex Context Automation

Codex automation separates global registration from project activation. `hooks install` merges two synchronous command handlers into the user Hook file and writes its ownership receipt last. It preserves group order and non-owned handlers, changes the canonical feature flag only when required, and refuses unreceipted lookalikes, duplicates, or concurrent changes to owned state. When the receipt records no ContextRail feature edit, later Codex trust-state changes in `config.toml` remain current only while the Hook feature stays enabled. Apply writes through sibling temporary files and restores the captured precondition state on failure.

Every scaffold carries an explicit disabled `automation.codex` object. `automation enable` may update only a config matching the ownership hash recorded in `.context-rail/version.json`; the config and new ownership hash are one guarded transition. Disable retains the route/check preferences while setting the activation gate false.

`UserPromptSubmit` walks upward from the Hook `cwd` to locate an enabled ContextRail project. It selects ordinary route context or exact continuation intent, emits only bounded project-relative paths, state references, and argv validation hints through `additionalContext`, and does not echo the prompt. Outside an enabled project it emits nothing.

`Stop` validates documents and state without executing hints. Passing and disabled cases emit an empty JSON object. Violations emit a bounded `systemMessage`, never a blocking decision. Handler failures also return a concise fail-open message with exit code zero. After an enabled handler completes, ContextRail atomically overwrites one Git-ignored diagnostic marker containing only event, timestamp, hashed session identifier, identifier source, project match, and result status. Marker failure is fail-open and no prompt, assistant, tool, secret, or personal-path content is recorded.

Verification distinguishes exact registration, duplicate/mismatched entries, executable paths, feature state, receipt currency, non-owned Hook preservation, project opt-in, isolated route/continue/check smoke, and recent Stop dispatch. A Stop marker is dispatch evidence, not Throughline capture evidence. Verification never claims that a live Codex conversation consumed injected context or that Throughline captured it without the corresponding external structured evidence.

## Instruction Routing

The root `AGENTS.md` contains only the mission, absolute rules, document entry point, work loop, validation policy, and `continue` behavior. Nested `AGENTS.md` files add local deltas near the governed files and may not weaken root absolute rules.

`route PATH` reports the root-to-target instruction chain, the relevant authority and state files, the instruction byte total, and recommended validation. It does not claim that every agent host discovers nested instructions dynamically.

## Continue Contract

In native mode, `continue` returns a deterministic projection rather than invoking an AI model. It resolves:

1. root and nearest applicable instruction files;
2. the active backlog item referenced by `CURRENT.md`;
3. the next one or two incomplete plan steps;
4. referenced authority documents;
5. expected source and test paths;
6. targeted validation commands.

If the current item is blocked, missing, inconsistent, or ambiguous, the command reports the conflict instead of selecting unrelated work.

In references mode, `continue` returns the instruction chain, document router, mapped current/plan/backlog paths, and validation hints. It does not parse a repository-specific backlog or guess the next item; the agent must read those references according to the repository's own instructions.

## Measurement

Runtime measurements are local and Git-ignored by default under `.context-rail/runtime/`. Every value records one provenance: `host_reported`, `tool_reported`, `manual`, or `estimated`.

The schema supports input tokens, output tokens, context-window size, turns, conversation transitions, repeated explanations, files read, document lines or bytes read, selective-versus-full document load, focused and full validations, failures, rework, and handoff size.

ContextRail does not intercept agent traffic in the MVP. It records explicit inputs and adapter-provided values. Reports never mix measured and estimated values without preserving provenance. Performance claims require a reproducible task manifest and before/after evidence.

## Throughline Boundary

Throughline is optional. ContextRail Core never imports Throughline source and never reads its SQLite database directly. The adapter calls documented commands and treats their structured output as external evidence.

ContextRail stores only:

- canonical repository URL;
- exact upstream base commit;
- exact local compatibility commit;
- a full-index binary patch series and SHA-256;
- compatibility fixtures, application conditions, removal conditions, license, and notices.

It does not copy the complete Throughline source or require a fork.

The initial integration pins:

- repository: `https://github.com/kitepon/Throughline.git`;
- base: `4bf84f548eeb7173a3b46be33b9b0c54723ab21f`;
- compatibility commit: `aea08a5537de358ff273f3d7eb98ac133cc990dd`;
- upstream license: MIT.

Preparation clones the exact base into a temporary directory, verifies `HEAD`, runs `git apply --check`, applies the patch, runs focused compatibility tests and the relevant upstream suite, and produces a tarball. Tests use temporary HOME and npm prefixes.

Real installation requires explicit `--apply`. It uses a ContextRail-managed, versioned npm prefix rather than modifying an existing global `node_modules` tree. It displays affected paths, preserves non-Throughline hooks, records configuration hashes, keeps the previous managed release for rollback, and does not edit shell startup files.

Integration readiness states are `prepared`, `installed`, `hooks_ready`, `capture_verified`, `degraded`, and `incompatible`. Hook registration and ContextRail Stop dispatch alone are not capture verification. A live smoke must show non-zero body capture, user/assistant L2 bodies, tool L3 details, and exclusion of host-injected AGENTS and recommended-plugin context. Missing Codex authentication or a live rollout leaves the installation explicitly unverified.

## Security and Failure Handling

- No arbitrary shell strings; child processes receive an executable and argument array.
- External source identity is verified before patching.
- Patch mismatch and test failure stop installation without fallback.
- Real-home tests are forbidden; fixtures use temporary HOME.
- Existing non-owned files and settings are preserved.
- ContextRail Codex Hook install/uninstall owns only its exact receipt-recorded entries and feature edit; it never removes Throughline or unrelated groups.
- Rollback restores only ContextRail-managed releases and configuration entries, and refuses an unsafe restore if current hashes show concurrent external changes.
- No secrets, tokens, raw transcripts, or personal absolute paths enter committed fixtures or reports.

## Delivery Slices

The approved implementation is delivered in four independently testable slices:

1. repository, documentation, state, and hierarchical instruction foundation;
2. validator, bootstrap/adopt/upgrade planning, route, and continue;
3. measurement and Throughline patch/install/verification adapters;
4. CI, user documentation, security review, third-party notices, full diff review, and first implementation commit.

Each slice executes one or two active plan steps at a time and performs focused validation before advancing.

## Deferred Scope

The MVP excludes package-registry publication, GUI, hosted telemetry, remote services, automatic model selection, automatic subagent/worktree execution, vector indexing, RAG, and integrations beyond Throughline.
