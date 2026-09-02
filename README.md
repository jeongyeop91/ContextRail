# ContextRail

[![verify](https://github.com/jeongyeop91/ContextRail/actions/workflows/verify.yml/badge.svg)](https://github.com/jeongyeop91/ContextRail/actions/workflows/verify.yml)
[![GitHub release](https://img.shields.io/github/v/release/jeongyeop91/ContextRail)](https://github.com/jeongyeop91/ContextRail/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 22.13+](https://img.shields.io/badge/Node.js-22.13%2B-339933)](package.json)

ContextRail is a repository-local operating foundation for coding agents. It helps an agent load only relevant instructions and authority, follow durable project state, validate changes, and continue work in a new conversation without treating chat history as project memory.

ContextRail is product-neutral, has no production npm dependencies, and works offline for its core commands. Throughline integration is optional.

## Install and set up

The current release candidate supports macOS, Linux, and native Windows. Install it from the npm public registry, open a terminal in the project directory, and run setup:

```text
npm install --global contextrail@next
contextrail setup
contextrail doctor
contextrail handoff
```

`contextrail setup` defaults to the current directory and the full profile. It discovers the project without writing, prints a short human-readable plan, and asks `Apply? [y/N]` only in an interactive terminal. The full profile initializes or adopts ContextRail, installs the pinned Codex-compatible Throughline, appends ContextRail Codex Hooks, enables the selected project, and verifies the result. Use `contextrail doctor` for the concise readiness result, then `contextrail handoff` to continue the latest captured work in a new Codex Desktop task.

Follow [Apply ContextRail to a new project](#apply-contextrail-to-a-new-project) for an empty directory or [Apply ContextRail to an existing project](#apply-contextrail-to-an-existing-project) when the repository already has its own instructions, documentation, and project state.

Windows live validation is still pending. Use `@next` until the [native Windows pilot](docs/reference/WINDOWS_PILOT.md) passes; afterward the stable command becomes `npm install --global contextrail`. The npm tag is `latest`, not `last`.

### Choose a setup profile

| Profile | Command | Installs |
| --- | --- | --- |
| Full default | `contextrail setup` | Core, managed Throughline, both Hook sets, project automation |
| Core only | `contextrail setup --core-only` | Repository-local ContextRail only; no HOME or network integration writes |
| Memory without ContextRail Hooks | `contextrail setup --no-context-hooks` | Core and managed Throughline; no ContextRail context Hooks or automation |
| Existing Throughline | `contextrail setup --use-existing-throughline` | Core and ContextRail Hooks after verifying the unmanaged Throughline |

For Codex, CI, or any non-interactive terminal, review and apply through explicit machine-readable boundaries:

```text
contextrail setup --dry-run --json
contextrail setup --apply --json
```

A flagless non-interactive `contextrail setup` prints a plan and never waits or writes. `--apply` is the only non-interactive write authorization.

A newly configured host normally reports `installed_live_verification_required`: structural installation and synthetic checks passed, while a trusted Codex session must still prove live ContextRail consumption and Throughline capture, restore, and handoff.

### Human, machine, and debug output

Flagless `setup`, `doctor`, and `handoff` output is intentionally short and written for a person. Use `--json` when another program needs the stable structured contract. Use `--debug` only when troubleshooting requires component paths or upstream command evidence:

```text
contextrail doctor
contextrail doctor --json
contextrail doctor --debug
```

`--json` and `--debug` are mutually exclusive. Debug output can contain local paths and upstream diagnostics, so review it before sharing.

### Continue in a new Codex task

After at least one trusted Codex turn has been captured, start a fresh Codex Desktop task and inject the latest available Throughline handoff memory with one command:

```text
contextrail handoff
```

Use an explicit source only when you need a specific captured task:

```text
contextrail handoff --session codex:<source-task-id>
```

Codex Desktop is the default host. Use `--open-host vscode`, `--open-host cli`, or `--open-host auto` only when you want another host-selection behavior; `--open-host desktop` remains an explicit equivalent. The command uses the managed Throughline release selected by ContextRail, creates a different Codex task, injects the handoff memory, and opens it in the selected host. It does not mutate or resurrect the current task. If opening fails after task creation, the concise result keeps the new task ID and prints the manual resume command. Do not rerun `handoff` in that case, because every successful invocation creates a different task.

### Diagnose automatic capture

`contextrail doctor` reports project readiness, managed Throughline, Codex Hook registration and trust, recent ContextRail Stop dispatch, and automatic Throughline capture as separate components. A bounded Stop marker proves that Codex invoked the ContextRail Stop handler; a Throughline database record proves capture. **Stop dispatch and Throughline capture are not the same evidence.**

The Stop marker contains only timestamp, hashed session identifier, source, project match, and result status. It contains no prompt, response, transcript, tool body, secret, or personal path, and is stored under the Git-ignored `.context-rail/runtime/` directory.

### Audited GitHub fallback

The npm tarball and versioned GitHub asset are byte-identical. Install the immutable release-candidate asset if npm is unavailable:

```text
npm install --global https://github.com/jeongyeop91/ContextRail/releases/download/v0.3.0-rc.13/contextrail-0.3.0-rc.13.tgz
contextrail setup
```

Verify the CLI with `contextrail --version`; the expected candidate version is `0.3.0-rc.13`.

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
- npm for global installation from the registry or verified GitHub Release package.

ContextRail does not require Codex, Throughline, a hosted service, or a globally installed package for checkout-based use.

## Installation details

### Run from a checkout

```bash
git clone https://github.com/jeongyeop91/ContextRail.git
cd ContextRail
node bin/contextrail.mjs --version
npm test
```

### Update or remove

Update the candidate with `npm install --global contextrail@next`. Remove only the ContextRail CLI with:

```bash
npm uninstall --global contextrail
```

Removing the npm package does not remove managed Throughline or Hook receipts. Use the lower-level receipt-guarded uninstall and rollback commands when you deliberately want to remove those components. ContextRail never edits shell startup files.

## Apply ContextRail to a new project

Use this how-to for an empty directory, optionally containing only `.git`. The commands are the same in PowerShell, macOS, and Linux terminals.

1. Open a terminal in the new project directory.
2. Install the current release candidate and run the interactive full setup:

```text
npm install --global contextrail@next
contextrail setup
```

3. Review the displayed plan and answer `y` only when the target and components are correct. In Codex or another non-interactive environment, use the explicit boundary instead:

```text
contextrail setup --dry-run --json
contextrail setup --apply --json
```

4. In Codex Desktop, review the newly registered Hook commands, trust them, and restart Codex Desktop. Send one normal project prompt so live capture has content, then check readiness and continue in a new task:

```text
contextrail doctor
contextrail handoff
```

The generated neutral project contains `AGENTS.md`, a routed authority document, and native file memory under `state/`. Start future work by reading `AGENTS.md`, `docs/README.md`, and `state/CURRENT.md`.

## Apply ContextRail to an existing project

Use this how-to when a mature repository already has its own instructions, documentation, status, plans, and backlog. ContextRail maps those files instead of creating competing authority or state.

1. Back up the repository, open it in Codex Desktop, and open a terminal in its root directory. Install or update ContextRail:

```text
npm install --global contextrail@next
contextrail --version
```

2. Ask Codex to inspect the existing repository and prepare the required mapping. Paste this prompt into a Codex task opened for that repository:

```text
Inspect this repository read-only. Read AGENTS.md and the documentation router first when they exist. Identify the existing instruction file, document router, authority roots and exclusions, current-state file, plan directory, backlog file, and argv-based validation hints. Create a temporary existing-repository adoption JSON outside the repository. Run `contextrail setup --project existing --adoption-config <temporary-file> --dry-run --json`. Show me the adoption JSON and complete setup plan, explain any uncertain mapping, and stop before `--apply`. Do not modify the repository.
```

Running `contextrail setup` without that config in a non-empty unconfigured repository intentionally returns `needs_input` and candidate paths. ContextRail does not guess which existing files are authoritative.

3. Review the temporary config. A repository-specific mapping has this form:

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

4. After every mapped path and validation command is correct, use the exact temporary path reported by Codex and run the full setup dry run and apply. Keep each command on one line so it works in PowerShell, macOS, and Linux after replacing the example path:

```text
contextrail setup --project existing --adoption-config "/absolute/path/adoption-config.json" --dry-run --json
contextrail setup --project existing --adoption-config "/absolute/path/adoption-config.json" --apply --json
```

All mapped paths must be repository-relative. Authority roots are recursive; exclusions can name a file or directory subtree. Validation hints must be argv arrays and are returned as data, never executed automatically.

The adoption part of setup creates only:

- `.context-rail/config.json`
- `.context-rail/version.json`
- `.context-rail/.gitignore`, containing only `runtime/`

It does not modify existing `AGENTS.md`, the document router, authority, current state, plans, backlog, or root `.gitignore`. The full setup additionally installs the managed Throughline release, registers the ContextRail and Throughline Codex Hooks through their guarded boundaries, and enables automation only for this project.

5. Review and trust new or changed Hook commands in Codex Desktop, restart the app, and send one normal prompt in the repository. Then verify capture and perform a one-command handoff:

```text
contextrail doctor
contextrail handoff
```

For later ContextRail updates, stay in the same repository and rerun `npm install --global contextrail@next` followed by `contextrail setup`. Keep the existing `.context-rail` mapping; do not create a new adoption config unless the repository's authority or state paths have changed.

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

`UserPromptSubmit` supplies bounded paths, state references, and validation hints as additional context; it never echoes the raw prompt. A prompt consisting of `continue`, `계속해`, `계속`, or `이어서` selects continuation context. `Stop` runs the read-only ContextRail document/state check and reports violations without returning a Codex block decision or executing validation hints. After the handler completes, it atomically records the bounded diagnostic marker described above; this is the only Stop-side project write.

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
| `contextrail setup` | Plan or interactively apply the selected end-to-end profile | No |
| `contextrail doctor` | Print concise project, Hook, Stop-dispatch, and capture readiness | No |
| `contextrail handoff` | Create a new Codex task with managed Throughline memory | Yes, new Codex task |
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
contextrail handoff --open-host desktop
```

The primary setup command selects and SHA-256 verifies the pinned GitHub Release artifact automatically. Advanced lower-level installation can still accept a locally prepared artifact. ContextRail Core works without Throughline. See [the integration authority](docs/authority/INTEGRATIONS.md) and [integration README](integrations/throughline/README.md) for details.

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

### Hooks are trusted but automatic capture is missing

Run `contextrail doctor` first. If `Stop dispatch` and `Throughline capture` do not identify the failing boundary, run `contextrail doctor --debug` and inspect the redacted ContextRail evidence plus upstream Throughline diagnostics. Use `contextrail doctor --json` for automation; do not parse the human text.

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

- `0.3.0-rc.13` is the npm `next` release candidate; `latest` remains gated on the final Windows flagless-handoff check.
- Node.js 22.13 or newer is required.
- Validation hints are returned but never executed automatically.
- Throughline is optional in reduced profiles and automatically installed or verified by the full setup profile.
- Live Codex context injection needs a trusted session and cannot be proven by configuration inspection alone.
- A recent ContextRail Stop marker proves Hook dispatch, not successful Throughline capture; `doctor` reports them independently.
- No GUI, hosted telemetry, vector index, or RAG service is included.
