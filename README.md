# ContextRail

[![verify](https://github.com/jeongyeop91/ContextRail/actions/workflows/verify.yml/badge.svg)](https://github.com/jeongyeop91/ContextRail/actions/workflows/verify.yml)
[![GitHub release](https://img.shields.io/github/v/release/jeongyeop91/ContextRail)](https://github.com/jeongyeop91/ContextRail/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 22.13+](https://img.shields.io/badge/Node.js-22.13%2B-339933)](package.json)

ContextRail is a repository-local operating foundation for coding agents. It helps an agent load only relevant instructions and authority, follow durable project state, validate changes, and continue work in a new conversation without treating chat history as project memory.

ContextRail is product-neutral, has no production npm dependencies, and works offline for its core commands. Throughline integration is optional.

## Choose your workflow

| Your repository | Start here |
| --- | --- |
| New or empty | [Create a neutral project](#create-a-new-project) |
| Existing, with its own docs and state | [Adopt an existing repository](#adopt-an-existing-repository) |
| Created from this GitHub template | [Use the template repository](#use-the-template-repository) |
| Already uses ContextRail | Run `contextrail check`, `route`, or `continue` |

## What ContextRail provides

- Hierarchical root and subtree `AGENTS.md` instructions.
- A short documentation router and bounded Active Authority.
- A `search -> locate -> bounded read -> modify -> targeted validation` loop.
- Native `CURRENT.md`, `PLAN.md`, `BACKLOG.json`, and ADR-based memory.
- References mode for repositories that already own their state and backlog formats.
- Plan-first `init`, `adopt`, and hash-guarded `upgrade` operations.
- Deterministic `check`, `route`, and `continue` projections.
- Optional Codex Hooks that inject bounded route/continuation context and run a non-blocking Stop check for opted-in projects.
- Local, provenance-labelled context measurements.
- An optional, separately managed Throughline bridge.

ContextRail does not claim a token-reduction percentage. Performance claims require comparable tasks, a declared baseline, and measurements with explicit provenance.

## Requirements

- Node.js 22.13 or newer.
- Git for repository workflows and optional Throughline preparation.
- npm for global installation from the GitHub Release package.

ContextRail does not require Codex, Throughline, a hosted service, or a globally installed package for checkout-based use.

## Install ContextRail

ContextRail is not published to the npm registry. The recommended global installation source is the verified package attached to the latest GitHub Release.

### Install the v0.2.0 release

```bash
npm install --global \
  https://github.com/jeongyeop91/ContextRail/releases/download/v0.2.0/contextrail-0.2.0.tgz

contextrail --version
contextrail --help
```

Expected version:

```text
0.2.0
```

### Run from a checkout

```bash
git clone https://github.com/jeongyeop91/ContextRail.git
cd ContextRail
node bin/contextrail.mjs --version
npm test
```

You can also install the immutable tag source:

```bash
npm install --global \
  https://github.com/jeongyeop91/ContextRail/archive/refs/tags/v0.2.0.tar.gz
```

### Update or remove

Re-run the release installation command to replace an older ContextRail CLI. Remove only ContextRail with:

```bash
npm uninstall --global contextrail
```

Package installation and removal do not manage Throughline, Codex Hooks, skills, configuration, other global npm packages, or shell startup files. Hook changes occur only through the explicit `hooks ... --apply` commands below.

## Create a new project

Write-capable commands are plan-first. Review the dry run before applying it.

```bash
project_root="$(mktemp -d)"

contextrail init --target "$project_root" --dry-run --json
contextrail init --target "$project_root" --apply --json
contextrail check --target "$project_root" --json
```

`init` accepts an empty target, except that an existing `.git` directory is allowed. The generated neutral project contains hierarchical instructions, a routed authority document, and native file memory.

Next, ask an agent to start with the generated `AGENTS.md`, `docs/README.md`, and `state/CURRENT.md`.

## Adopt an existing repository

Use `existing-repository` when a mature project already has instructions, documentation, status, plans, and a backlog. ContextRail maps those files instead of creating competing authority or state.

Create a repository-specific JSON mapping:

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

Then review and apply:

```bash
contextrail adopt \
  --target /path/to/project \
  --profile existing-repository \
  --adoption-config /path/to/adoption-config.json \
  --dry-run --json

contextrail adopt \
  --target /path/to/project \
  --profile existing-repository \
  --adoption-config /path/to/adoption-config.json \
  --apply --json
```

All mapped paths must be repository-relative. Authority roots are recursive; exclusions can name a file or directory subtree. Validation hints must be argv arrays and are returned as data, never executed automatically.

Existing-repository apply creates only:

- `.context-rail/config.json`
- `.context-rail/version.json`
- `.context-rail/.gitignore`, containing only `runtime/`

It does not modify existing `AGENTS.md`, the document router, authority, current state, plans, backlog, or root `.gitignore`.

## Native state and references mode

| Behavior | Native state | References mode |
| --- | --- | --- |
| Intended repository | New or neutral project | Mature existing project |
| Current state | ContextRail Markdown contract | Existing project file |
| Plan | One active ContextRail plan | Existing plan directory |
| Backlog | ContextRail JSON schema | Existing format, including YAML |
| `continue` | Selects a consistent active or ready item | Returns paths without guessing an item |
| File ownership | Generated state is scaffold-owned | Mapped state remains project-owned |

## Everyday workflow

Route context before opening broad parts of the repository:

```bash
contextrail check --target /path/to/project --json
contextrail route src/example.mjs --target /path/to/project --json
contextrail continue --target /path/to/project --json
```

`route` returns applicable `AGENTS.md` files in root-to-target order, the document router and linked documents, state context, and validation hints. `continue` performs no model call, Git operation, test, or mutation.

## Optional Codex automatic context

Codex automation has two separate gates: install the user-level Hook handlers once, then opt in each ContextRail project. New and adopted projects default to disabled.

Review the user-level plan, then explicitly apply it:

```bash
contextrail hooks install --host codex --dry-run --json
contextrail hooks install --host codex --apply --json
```

The installer appends one synchronous `UserPromptSubmit` handler and one synchronous `Stop` handler to `~/.codex/hooks.json`. It preserves existing Throughline and unrelated groups, enables the canonical Codex `hooks` feature only when needed, and records a hash-guarded receipt under `~/.codex/contextrail/`. Concurrent edits or duplicate ContextRail handlers are conflicts, not overwrite candidates.

Enable automation for a selected project only after reviewing its plan:

```bash
contextrail automation enable --host codex --target /path/to/project --dry-run --json
contextrail automation enable --host codex --target /path/to/project --apply --json
contextrail hooks verify --host codex --target /path/to/project --json
```

`UserPromptSubmit` supplies bounded paths, state references, and validation hints as additional context; it never echoes the raw prompt. A prompt consisting of `continue`, `계속해`, `계속`, or `이어서` selects continuation context. `Stop` runs the read-only ContextRail document/state check and reports violations without returning a Codex block decision or executing validation hints.

`hooks verify` checks exact commands, executable paths, duplicate entries, feature and receipt state, preservation of non-owned Hooks, selected-project opt-in, and isolated synthetic Hook behavior. It reports live Codex context injection as `unverified`; confirm that only by starting or restarting a trusted Codex session and observing the next prompt. Codex may require repository trust before project configuration takes effect.

Disable a project without removing the user-level handlers, or uninstall only ContextRail-owned handlers:

```bash
contextrail automation disable --host codex --target /path/to/project --dry-run --json
contextrail automation disable --host codex --target /path/to/project --apply --json
contextrail hooks uninstall --host codex --dry-run --json
contextrail hooks uninstall --host codex --apply --json
```

Uninstall restores only the feature edit recorded by ContextRail and refuses to proceed if live Hook/config hashes changed. It never removes Throughline or user-owned handlers.

## Command reference

| Command | Purpose | Writes by default |
| --- | --- | --- |
| `contextrail --version` | Print the installed version | No |
| `contextrail --help` | Print CLI usage | No |
| `contextrail init` | Plan or create a neutral foundation in an empty target | No |
| `contextrail adopt` | Plan or add missing neutral scaffold files | No |
| `contextrail adopt --profile existing-repository` | Map an existing repository without duplicate state | No |
| `contextrail upgrade` | Update only files matching prior owned hashes | No |
| `contextrail check` | Validate documentation and state contracts | No |
| `contextrail route PATH` | Return instructions and routed context for a target | No |
| `contextrail continue` | Return deterministic continuation context | No |
| `contextrail measure record` | Append an explicit local measurement | Yes |
| `contextrail measure report` | Summarize local measurements | No |
| `contextrail throughline prepare` | Plan reproducible Throughline preparation | No |
| `contextrail throughline install` | Plan or explicitly apply managed installation | No |
| `contextrail throughline verify` | Read Throughline version and diagnostics | No |
| `contextrail throughline rollback` | Explicitly restore managed integration state | No |
| `contextrail hooks install` | Plan or explicitly register user-level Codex handlers | No |
| `contextrail hooks verify` | Inspect registration and run isolated synthetic smoke | No |
| `contextrail hooks uninstall` | Plan or explicitly remove owned Codex handlers | No |
| `contextrail automation enable\|disable` | Plan or explicitly change one project's Codex opt-in | No |

Run `contextrail --help` for supported flags. Project commands use exit code `0` for success, `1` for project contract violations, `2` for invalid CLI/configuration input, and `3` for external integration failures.

## Use the template repository

Choose **Use this template** on [the ContextRail repository](https://github.com/jeongyeop91/ContextRail), or open [Create a repository from ContextRail](https://github.com/new?template_name=ContextRail&template_owner=jeongyeop91).

A template copy contains the self-hosting CLI, tests, file memory, and neutral scaffold. Replace ContextRail's project-specific authority and state when the copy becomes a different control repository. To initialize another product repository, use the CLI's `init` command instead.

## Validation and development

From a checkout:

```bash
npm test
npm run check
npm run smoke:template
npm run verify
npm pack --dry-run
```

`check` validates router and authority limits, relative Markdown links and anchors, root confinement, native backlog consistency, or references-mode path existence. The default check is offline and does not fetch external links or run validation hints.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development contract.

## Local measurement

```bash
contextrail measure record \
  --task CR-001 --session local-session --source manual \
  --input-tokens 100 --output-tokens 20
contextrail measure report --json
```

Records are JSONL under `.context-rail/runtime/`, which Git ignores. Session identifiers are hashed. Prompts, responses, transcripts, secrets, and personal paths are rejected. Estimated values remain separate from reported aggregates.

## Optional Throughline bridge

ContextRail owns repository routing, authority, file memory, validation hints, and measurements. Throughline independently owns capture, restore, handoff, hooks, monitoring, and its database.

```bash
contextrail throughline prepare --dry-run --json
contextrail throughline install --dry-run --json
contextrail throughline verify --json
```

Real installation requires explicit apply and a prepared artifact. ContextRail core works without Throughline. See [the integration authority](docs/authority/INTEGRATIONS.md) and [integration README](integrations/throughline/README.md) for details.

## Safety model

- Write-capable project commands expose a plan and require explicit `--apply` to write.
- Existing files are skipped or reported as conflicts unless ownership hashes prove a safe upgrade.
- Repository paths are normalized and confined to the selected root.
- Executable boundaries use argv arrays rather than shell command strings.
- Core checks do not mutate the repository or user environment.
- Codex automation is project opt-in, bounded, fail-open, and never executes routed validation hints.
- User-level Hook changes preserve non-owned groups and use receipt/hash guards for install and uninstall.
- Runtime measurements and generated package archives are Git-ignored.

See [SECURITY.md](SECURITY.md) for supported versions, reporting, and security boundaries.

## Troubleshooting

### `contextrail: command not found`

Confirm the npm global prefix and executable location:

```bash
npm config get prefix
npm list --global contextrail --depth=0
```

Add the prefix's `bin` directory to `PATH` using your operating system or shell documentation. ContextRail does not edit shell startup files.

### Node.js version errors

Run `node --version`. ContextRail requires Node.js 22.13 or newer.

### `init` reports `TARGET_NOT_EMPTY`

Use `init` only for an empty target. Use neutral `adopt` for a partially prepared repository or `existing-repository` for a mature repository with its own authority and state.

### Adoption or upgrade reports a conflict

Do not remove ownership checks or force an overwrite. Review the reported file, preserve user-owned content, and decide whether the repository mapping or file ownership is correct.

### `check` returns issues

Use the stable issue `code`, `path`, and `message` fields in JSON output. Fix the referenced project contract and run the narrowest relevant validation before repeating the full check.

## Project links

- [Latest release](https://github.com/jeongyeop91/ContextRail/releases/latest)
- [Changelog](CHANGELOG.md)
- [Documentation router](docs/README.md)
- [Architecture](docs/authority/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

Use the GitHub issue forms for reproducible bugs and scoped feature requests. Report vulnerabilities privately as described in the security policy.

## License

ContextRail is available under the [MIT License](LICENSE).

## Known limitations

- No npm registry publication; installation uses a GitHub release or tag.
- Node.js 22.13 or newer is required.
- Validation hints are returned but never executed automatically.
- Throughline is optional and independently installed.
- Live Codex context injection needs a trusted session and cannot be proven by configuration inspection alone.
- No GUI, hosted telemetry, vector index, or RAG service is included.
