# ADR-0003: Cross-platform full installation from GitHub Releases

- Status: accepted
- Date: 2026-08-27

## Context

ContextRail can scaffold or adopt a repository, manage its own Codex Hooks, and install a prepared Throughline artifact. The published README does not currently provide an end-to-end path from a clean computer: ContextRail installation is separate, Throughline preparation is plan-only, managed installation requires an externally supplied tarball, and the documented commands do not compose the project and user-level steps.

The supported onboarding contract must let a user discover the project on GitHub, install it on macOS, Windows, or Linux, and configure either a new or existing repository. The recommended path must expose the complete ContextRail experience, including the Codex-compatible Throughline bridge and ContextRail context automation. Optional profiles must remain explicit, and every write must retain a reviewed apply boundary.

Windows native PowerShell is a first-class target because the initial external pilot will run there. WSL is treated as a separate Linux environment and must not silently configure a Windows-native Codex installation.

## Decision

### Release assets

Each full-install-capable ContextRail release publishes:

- `contextrail-<version>.tgz`;
- the pinned Codex-compatible `throughline-<version>.tgz`;
- `release-manifest.json`; and
- human-verifiable checksums.

The ContextRail package embeds the same release manifest used to publish the assets. The manifest pins artifact URLs and SHA-256 digests, Throughline source and compatibility commits, patch digest, supported Node.js version, supported operating systems, and the condition for removing the patch. Apply downloads only immutable manifest-selected assets and verifies their digest before installation. Core commands remain offline-capable.

### Setup command

Add a compositional command with plan-first behavior:

```text
contextrail setup --project new --dry-run|--apply [options]
contextrail setup --project existing --adoption-config FILE --dry-run|--apply [options]
```

The target defaults to the current directory. `--target PATH` is used only when operating on another directory. README examples do not use `$PWD` or platform-specific current-directory variables.

Full installation is the default and includes:

1. ContextRail project initialization or adoption;
2. a compatible managed Throughline release and its capture Hooks;
3. ContextRail `UserPromptSubmit` and `Stop` Hooks;
4. project-level ContextRail Codex automation enablement; and
5. aggregate structural and integration verification.

Supported selections are:

- `--core-only`: repository-local ContextRail without Throughline or ContextRail Hooks;
- `--no-context-hooks`: install or reuse Throughline but omit ContextRail context Hooks and project automation;
- `--use-existing-throughline`: preserve and verify an existing compatible Throughline instead of selecting a managed release.

Incompatible combinations are rejected as input errors. Existing-repository setup never invents project authority or state mappings. It requires an explicit adoption config and preserves the current existing-repository ownership contract.

The existing `init`, `adopt`, `throughline`, `hooks`, and `automation` commands remain public lower-level interfaces for advanced use, recovery, and troubleshooting.

### Planning and apply flow

Dry run performs read-only discovery and returns an ordered component plan. It checks prerequisites, project classification, adoption mappings, release metadata, existing installations, Hook conflicts, intended paths, and validation commands. It does not download assets or write project or user files.

Apply executes the approved component plan in this order:

1. download and verify immutable release assets in a temporary location;
2. install or reuse Throughline through its managed receipt boundary;
3. initialize or adopt the target repository;
4. install ContextRail-owned Codex Hooks while preserving non-owned Hooks;
5. enable only the selected project; and
6. run aggregate verification.

Each component retains its existing ownership receipt, precondition hashes, atomic writes, and rollback rules. Setup adds a resumable orchestration record but does not pretend that project and user-home writes form one filesystem transaction. A failure reports completed, failed, pending, and recoverable steps. Re-running the same apply verifies completed steps and resumes safely. It never removes or rewrites an unmanaged Throughline installation to make progress.

### Cross-platform execution

The implementation supports `darwin`, `linux`, and native `win32` without depending on a POSIX shell.

- Process boundaries remain executable-plus-argv arrays.
- Installed JavaScript package binaries are invoked through the selected absolute Node executable and their resolved JavaScript bin entry, not a platform-specific npm `.cmd` shim.
- Codex command Hooks provide a POSIX `command` and a Windows `commandWindows` override with platform-specific, tested argument encoding.
- Paths containing spaces, non-ASCII characters, and Windows drive letters are supported.
- The default managed data root follows the native platform convention: Application Support on macOS, XDG data on Linux, and LocalAppData on Windows.
- WSL setup is rejected for a detected Windows-native Codex home unless the user deliberately selects a matching environment.

Hook installation continues to use the active user's `.codex` directory, exact handler ownership, feature-state receipts, and non-owned Hook preservation.

### Verification states

Aggregate setup output distinguishes:

- ContextRail project readiness;
- Throughline installation and Hook readiness;
- ContextRail Hook registration and synthetic behavior;
- project automation enablement;
- live ContextRail additional-context consumption; and
- live Throughline capture, restore, and handoff evidence.

Configuration inspection and synthetic smoke tests never become live evidence. A newly configured host may finish as `installed_live_verification_required`. The README instructs the user to restart or open a trusted Codex session, perform the bounded live exercise, and rerun verification.

### README contract

The README starts with the complete installation path and then presents a mode table for full, core-only, memory-without-context-Hooks, and existing-Throughline installations. It includes separate new-project and existing-project flows, single-line commands that work in PowerShell and POSIX shells, a copyable Codex installation prompt, upgrade and removal guidance, failure recovery, and exact verification states.

The Codex prompt explicitly installs the ContextRail CLI from the immutable GitHub Release when absent. It then performs setup discovery and dry run, stops for review, and applies only after the user's explicit approval.

## Validation and release gates

Automated verification uses Node.js 22 on GitHub Actions runners for Ubuntu, macOS, and Windows. Tests install the packed release candidate into an isolated npm prefix and temporary user home. Coverage includes:

- full setup for new and existing repositories;
- preservation of mapped existing-repository files;
- all documented optional profiles;
- release download and checksum rejection;
- native path, quoting, spaces, and non-ASCII cases;
- ContextRail and Throughline Hook coexistence;
- conflicting or concurrently changed Hook/config state;
- partial failure, repeat apply, rollback, and removal guidance; and
- README command smoke from packed artifacts rather than the source checkout.

macOS live validation may be performed by the maintainer environment. Windows and Linux CI provide executable evidence but cannot prove a real Codex Desktop conversation consumed the Hooks. The first Windows release remains a release candidate with `Windows CI verified; live validation pending` until the user completes the supplied Windows Codex checklist. Failures return to implementation; a stable release is published only after the evidence is recorded. Linux live status is reported with the same precision unless a trusted live host is exercised.

## Alternatives

Documenting the existing lower-level commands would require users and agents to assemble download, verification, artifact selection, project adoption, Hook registration, and activation manually. It remains useful as reference documentation but is insufficient as the primary onboarding path.

Bundling Throughline inside the ContextRail npm tarball would reduce one download but would couple package size, update cadence, licensing review, and rollback identity. Separate immutable release assets with a pinned manifest keep the integration reproducible without vendoring the upstream tree.

Publishing only the Throughline asset without a release-aware installer would still require Codex or the user to assemble security-sensitive download and checksum steps. The asset and installer are therefore one feature.

## Consequences

The default onboarding experience now represents the complete product intent while preserving Core-only operation as an explicit option. The release pipeline becomes responsible for a second verified artifact, a manifest, and a three-operating-system test matrix. Setup orchestration adds implementation and recovery complexity, but lower-level ownership boundaries remain independently testable and reusable.

Windows support is not claimed from path-level unit tests alone. The repository can be completed and handed to the user with Windows CI evidence and a deterministic live test procedure, while the final stable support claim waits for the user's Windows pilot.
