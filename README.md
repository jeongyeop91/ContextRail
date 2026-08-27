# ContextRail

ContextRail is a repository-local operating foundation for coding agents. It routes an agent to the smallest relevant instruction and authority set, keeps durable project state in files, validates the contracts offline, and makes a new conversation continuable without treating raw chat history as project memory.

The project is product-neutral. It was informed by read-only analysis of mature project-operating patterns, but contains no Rathon product rules, documents, or source.

## What it provides

- Hierarchical root and subtree `AGENTS.md` instructions.
- A documentation router limited to 50 lines.
- Indexed Active Authority limited to 500 lines per file.
- A `search -> locate -> bounded read -> modify -> targeted validation` operating loop.
- `CURRENT.md`, one active `PLAN.md`, structured `BACKLOG.json`, and ADR-based memory.
- Safe bootstrap, adoption, and hash-guarded upgrade planning.
- Deterministic `route` and `continue` projections.
- Git-ignored local context and continuity measurements with provenance.
- An optional, reproducible Throughline compatibility bridge.

ContextRail does not claim a token-reduction percentage. Meaningful claims require comparable tasks, a declared baseline, and measurements whose reported and estimated provenance remains separate.

## Requirements

- Node.js 22.13 or newer.
- Git for repository workflows and optional Throughline preparation.
- No production npm dependencies.

Core checks, routing, continuation, scaffolding, and measurement work offline and do not require Throughline, Codex, a service, or a global npm package.

## Quick start

From a ContextRail checkout:

```bash
npm test
node bin/contextrail.mjs check
node bin/contextrail.mjs route src/core/documents.mjs --json
node bin/contextrail.mjs continue --json
```

Print CLI help or the installed release version with `contextrail --help` and `contextrail --version`.

## Installation

ContextRail is not published to the npm registry. Run it directly from a checkout, or install the verified `v0.1.0` GitHub Release artifact:

```bash
# Checkout usage
git clone https://github.com/jeongyeop91/ContextRail.git
cd ContextRail
node bin/contextrail.mjs --version

# Global CLI from the GitHub Release asset
npm install --global \
  https://github.com/jeongyeop91/ContextRail/releases/download/v0.1.0/contextrail-0.1.0.tgz
contextrail --version
```

The tag source is also installable with `npm install --global https://github.com/jeongyeop91/ContextRail/archive/refs/tags/v0.1.0.tar.gz`. Remove only this CLI with `npm uninstall --global contextrail`; neither installation nor removal manages Throughline, Codex hooks, skills, configuration, or shell startup files.

All write-capable project commands default to a plan or accept an explicit dry run. Apply a generated foundation only after reviewing the plan:

```bash
project_root="$(mktemp -d)"
node bin/contextrail.mjs init --target "$project_root" --dry-run --json
node bin/contextrail.mjs init --target "$project_root" --apply --json
node bin/contextrail.mjs check --target "$project_root"
```

`init` accepts only an empty target except `.git`. Neutral `adopt` creates missing scaffold files while preserving existing files. `upgrade` changes a scaffold-owned file only when its current SHA-256 matches the previously recorded owned hash; there is no general force-overwrite option.

## Adopt an existing repository

Use the `existing-repository` profile when a mature project already has instructions, documentation, status, plans, and a backlog. Put the mapping in a JSON file outside or inside the target, review a dry run, and then apply the same plan:

```bash
node /path/to/ContextRail/bin/contextrail.mjs adopt \
  --target /path/to/project \
  --profile existing-repository \
  --adoption-config /path/to/adoption-config.json \
  --dry-run --json

node /path/to/ContextRail/bin/contextrail.mjs adopt \
  --target /path/to/project \
  --profile existing-repository \
  --adoption-config /path/to/adoption-config.json \
  --apply --json
```

The schema maps, rather than replaces, existing files:

```json
{
  "schema": 1,
  "profile": "existing-repository",
  "documentRouter": "docs/README.md",
  "authority": {
    "roots": ["docs/product", "docs/architecture"],
    "exclude": ["docs/architecture/adr", "docs/STATUS.md"]
  },
  "state": {
    "mode": "references",
    "current": "docs/STATUS.md",
    "planDirectory": "plans",
    "backlog": "backlog/work.yaml"
  },
  "limits": { "routerLines": 50, "authorityLines": 500 },
  "instructionsFile": "AGENTS.md",
  "validationHints": [["node", "--test"]]
}
```

All mapped paths are repository-relative. Authority roots are recursive; exclusions may name a file or a directory subtree. Validation hints must be argv arrays and are returned by `check`, `route`, and `continue` but never executed automatically.

Apply creates only `.context-rail/config.json`, `.context-rail/version.json`, and `.context-rail/.gitignore`. The latter ignores only `runtime/`. Existing instructions, router, authority, current state, plans, backlog, and root `.gitignore` remain project-owned and unchanged.

## GitHub Template Repository use

This repository is self-hosting and can be marked as a GitHub Template Repository. A repository created from it includes the ContextRail CLI, tests, project memory, and the neutral project scaffold under `templates/project/`. Replace ContextRail's own state and authority when using the copy as a new control repository, or use its `init` command to create a clean product repository.

For a repository that does not yet have its own authority and state layout, keep a ContextRail checkout available and review neutral adoption before apply:

```bash
node /path/to/ContextRail/bin/contextrail.mjs adopt --target /path/to/project --dry-run --json
node /path/to/ContextRail/bin/contextrail.mjs adopt --target /path/to/project --apply --json
```

The generated files remain useful without the CLI, but retaining a ContextRail checkout or packaged release is required to run automated checks and upgrades.

## Context workflow

Start with `docs/README.md`. It routes each task to current authority rather than asking an agent to ingest the entire documentation tree. Then read `state/CURRENT.md` and the matching backlog item.

`route PATH` reports:

- applicable `AGENTS.md` files in root-to-target order;
- routed documents and instruction bytes;
- the active item and its targeted validation argv.

`continue` performs no model call, mutation, Git operation, or test. It deterministically returns the current work, up to two pending plan steps, authority, source hints, and validation. Blocked or ambiguous state returns stable issues instead of selecting unrelated work.

## Validation

```bash
npm test
node bin/contextrail.mjs check --json
npm run verify
```

`check` validates the bounded router and authority set, relative file and heading links, root confinement, backlog IDs/status/dependencies, CURRENT consistency, and the single-plan contract. Exit codes are `0` success, `1` repository violations, `2` CLI/configuration errors, and `3` external integration failure or incompatibility.

## Local measurement

```bash
node bin/contextrail.mjs measure record \
  --task CR-001 --session local-session --source manual \
  --input-tokens 100 --output-tokens 20
node bin/contextrail.mjs measure report --json
```

Records are JSONL under `.context-rail/runtime/`, which Git ignores. Session identifiers are hashed. Only numeric metrics are accepted; prompts, responses, transcripts, secrets, and personal paths are rejected. Sources are `host_reported`, `tool_reported`, `manual`, and `estimated`, and reports never merge estimates into reported aggregates.

## Optional Throughline bridge

Throughline and ContextRail have separate responsibilities. ContextRail owns repository routing, authority, file memory, validation hints, and measurements. Throughline owns capture, restore, handoff, hooks, monitoring, and its database.

Preparation is reproducible and plan-first:

```bash
node bin/contextrail.mjs throughline prepare --dry-run --json
node bin/contextrail.mjs throughline install --dry-run --json
node bin/contextrail.mjs throughline verify --json
```

The repository stores only immutable provenance, a hashed compatibility patch, the upstream MIT license, and synthetic tests—not the full Throughline source. Real preparation checks out the pinned base in a temporary directory, verifies HEAD, checks/applies the patch, runs the configured suites, and packs an artifact.

Installation requires both `--apply` and an explicit prepared tarball. It uses a versioned ContextRail-managed prefix, preserves unrelated hook entries, writes a receipt, and selects the release only after diagnostics. Rollback is also explicit and refuses concurrent configuration changes. Ordinary verification is read-only and does not open the Throughline database.

## Project status

The MIT-licensed `v0.1.0` release candidate is locally verified, including an isolated tarball installation. GitHub publication, Template Repository activation, release creation, and installation from the immutable release artifact remain pending until the release commit is created.

See [documentation routing](docs/README.md), [architecture](docs/authority/ARCHITECTURE.md), [contributing](CONTRIBUTING.md), [security](SECURITY.md), and [third-party notices](THIRD_PARTY_NOTICES.md).
