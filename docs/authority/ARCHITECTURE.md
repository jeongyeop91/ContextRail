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
- Throughline databases, hooks, migrations, capture contracts, or handoff semantics;
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
```

Commands that may write default to a plan-only dry run where the command contract specifies it. Existing files are never overwritten silently. Paths are normalized and confined to the selected target. Writes use a sibling temporary file followed by atomic rename.

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
- compatibility commit: `4d94defd2057df25eb24dc402d7b6c06fa1264d4`;
- upstream license: MIT.

Preparation clones the exact base into a temporary directory, verifies `HEAD`, runs `git apply --check`, applies the patch, runs focused compatibility tests and the relevant upstream suite, and produces a tarball. Tests use temporary HOME and npm prefixes.

Real installation requires explicit `--apply`. It uses a ContextRail-managed, versioned npm prefix rather than modifying an existing global `node_modules` tree. It displays affected paths, preserves non-Throughline hooks, records configuration hashes, keeps the previous managed release for rollback, and does not edit shell startup files.

Integration readiness states are `prepared`, `installed`, `hooks_ready`, `capture_verified`, `degraded`, and `incompatible`. Hook registration alone is not capture verification. A live smoke must show non-zero body capture, user/assistant L2 bodies, tool L3 details, and exclusion of host-injected AGENTS and recommended-plugin context. Missing Codex authentication or a live rollout leaves the installation explicitly unverified.

## Security and Failure Handling

- No arbitrary shell strings; child processes receive an executable and argument array.
- External source identity is verified before patching.
- Patch mismatch and test failure stop installation without fallback.
- Real-home tests are forbidden; fixtures use temporary HOME.
- Existing non-owned files and settings are preserved.
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
