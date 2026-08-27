# ADR-0004: Interactive two-command quickstart

- Status: accepted
- Date: 2026-08-27

## Context

ADR-0003 defines a safe, release-backed, cross-platform full setup, but the primary README path must be as approachable as Throughline's global-install-plus-install flow. Requiring users to understand project targets, release artifacts, Throughline versions, Hook commands, and every setup flag before the first successful run would preserve implementation boundaries at the expense of the product's onboarding goal.

ContextRail must keep plan-first writes and support non-interactive Codex and CI execution. It must also avoid pretending that a mature existing repository can be mapped correctly from filenames alone.

## Decision

### Primary README path

The first README installation example is two commands:

```text
npm install --global https://github.com/jeongyeop91/ContextRail/releases/latest/download/contextrail.tgz
contextrail setup
```

The release also retains a versioned ContextRail tarball and checksum evidence for reproducible or audited installation. The unversioned `contextrail.tgz` asset is byte-identical to the versioned tarball in the selected stable GitHub Release. Pre-release testing uses an explicit versioned asset rather than the `latest` redirect.

### Interactive setup

When attached to an interactive terminal, `contextrail setup`:

1. uses the current directory as its target;
2. selects the full installation profile;
3. performs read-only environment and project discovery;
4. renders the complete component plan and affected paths;
5. asks `Apply? [y/N]`; and
6. applies only after an affirmative response to that displayed plan.

The confirmation records the exact plan identity being approved. Any changed precondition invalidates the approval and requires a new plan.

When stdin is not an interactive terminal, a flagless `contextrail setup` is plan-only and never blocks waiting for input or writes implicitly. Codex and CI use explicit machine-readable boundaries:

```text
contextrail setup --dry-run --json
contextrail setup --apply --json
```

`--apply` remains the only non-interactive write authorization. The existing lower-level commands remain available.

### Project discovery

Setup classifies targets conservatively:

- an empty directory, with an optional `.git`, is a new project;
- a valid `.context-rail/config.json` is an already configured project;
- any other non-empty directory is an existing repository that needs an adoption mapping.

Setup does not infer authority or state semantics from filenames. For an unmapped existing repository it returns `needs_input`, reports discovered candidate paths, and supplies the exact adoption-config contract. The README provides a copyable Codex prompt that inspects the repository, prepares a temporary reviewed mapping, runs setup dry-run, and stops before apply. This is the easy existing-project path without weakening ownership guarantees.

### Optional modes

The quickstart remains full-install by default. Reduced profiles appear immediately after it in a compact mode table and retain the ADR-0003 flags. Users never need to locate or pass a Throughline artifact manually; setup resolves it through the pinned release manifest.

### Cross-platform presentation

The primary npm command is a single line that works in PowerShell and POSIX shells. README examples avoid `$PWD`, backslash line continuations, command substitution, and shell-specific environment syntax. Interactive input uses Node.js terminal APIs rather than a platform shell.

## Consequences

New and already configured projects receive a true two-command human onboarding path. Mature existing repositories require one semantic mapping step, but the README's Codex prompt performs that work and preserves a reviewed apply boundary.

The release process must publish and verify both stable-name and versioned ContextRail assets. The `latest` convenience URL is intentionally distinct from the immutable audited-install instructions. Tests must cover affirmative and negative interactive input, non-TTY plan-only behavior, changed-plan rejection, and Windows PowerShell execution.

ContextRail is not required to publish to the npm registry to achieve the quickstart. Registry publication may be reconsidered separately if package-name ownership, provenance, and release credentials are deliberately approved.
