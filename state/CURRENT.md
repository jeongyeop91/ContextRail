# Current state

Active item: `CR-008`

## Observed

- Codex ContextRail automation is approved for `UserPromptSubmit` route/continue and non-blocking `Stop` checks, with project opt-in defaulting to disabled.
- Current official Codex Hook documentation and the bundled desktop Codex executable agree on the event names, JSON fields, synchronous command handler, timeout, and additional-context contracts required by this work.
- The user Codex Hook and feature files were inspected read-only; Throughline handlers are present and must remain unchanged.
- ContextRail Codex automation runtime, ownership guards, temporary-HOME installer lifecycle, public CLI commands, and isolated verification smoke are implemented on `main`.
- The real-HOME ContextRail Hook dry run planned two appended entries without a feature change; read-only verify correctly reported `not_installed`, project automation disabled, isolated smoke passed, and live context injection unverified.
- The separately installed npm Codex CLI is currently degraded because its platform vendor executable is absent; the bundled desktop Codex executable is available.
- Existing-repository adoption is implemented on `main` and preserves mapped project-owned files.
- MIT and the `v0.1.0` public release defaults are approved for `jeongyeop91/ContextRail`.
- The public `jeongyeop91/ContextRail` repository is a GitHub Template Repository with release `v0.1.0`.
- The public repository includes install, update, removal, new-project, existing-repository, command-reference, troubleshooting, changelog, issue-form, and pull-request guidance.
- The global CLI is installed from the verified GitHub Release asset at `/opt/homebrew/bin/contextrail` and reports `0.1.0`.
- The local ContextRail MVP is implemented on `main` and tracks `origin/main` at `jeongyeop91/ContextRail`.
- Core operation is independent of Throughline and has no production npm dependencies.
- The compatibility patch is pinned to immutable Throughline source and patch hashes with its MIT notice.
- The user's Throughline installation was verified read-only as `degraded`: capture, restore, and handoff are ready; Codex hooks are not ready.
- No real Throughline preparation, installation, rollback, or HOME edit was performed.

## Completed evidence

- Architecture: `b3859b5`; execution plan: `4bf5c32`.
- Foundation: `5ac86bb`; validation: `8a3003d`; workflow: `34625ba`.
- Measurement: `2f5e932`; Throughline preparation: `2c472c9`; managed integration: `da2ee55`.
- Existing-repository profile: `c9da4ca`; reference authority and state mapping: `74df134`.
- Security read-only dry-run at `930b6ee1220e5cb2ce443efd1f76066ac2a69f30` planned only the three `.context-rail` metadata creates; HEAD and clean status were unchanged afterward.
- Final verification: 66 tests passed; self-check found 8 Active Authority files; neutral template smoke passed; `git diff --check` passed.
- Release-candidate verification: 69 tests passed; `npm run verify`, `npm pack --dry-run`, and isolated package version/help/init/check/adoption smoke passed.
- Release commit and annotated tag: `78b55b9` / `v0.1.0`; release asset SHA-256: `619c662017d42df6dda763b712a84ed520d703a6bb4a7d834f9e654f60f628a8`.
- Security read-only validation at `5b2c48ec65f08e7551d9dc3beb9cfc9619b0472f`: check passed, route returned root and gateway instructions, continue returned references mode, and HEAD/status remained unchanged.
- GitHub onboarding documentation and contribution templates were added after the `v0.1.0` release without changing the immutable release tag or asset.
- Codex Hook design and implementation commits: `c51efbc`, `4a1b29a`, `6ffaf18`, `daedd7b`, `806c458`, and `3befa6c`.
- The v0.2.0 release candidate passed 91 tests, self-check with 8 Active Authority files, neutral template smoke, package dry-run, isolated package version/help smoke, and `git diff --check`.
- Real-HOME install dry-run and read-only verify left the Hook/config hashes unchanged and did not create a ContextRail receipt.
- Release commit and annotated tag: `c4b2056` / `v0.2.0`; release asset SHA-256: `767ffc745c62425c0b1d5e8b3ad7ce25ee88238787d031789e121100f30cd2c0`.
- The published release asset digest matches the verified local artifact, and both `main` and tag GitHub Actions runs completed successfully.
- ADR-0003 records the approved full-install default, explicit reduced profiles, release-managed Throughline artifact, and macOS/Windows/Linux setup contract.
- ADR-0004 adds the approved two-command interactive quickstart while retaining explicit non-interactive dry-run and apply boundaries.
- ADR-0005 approved an npm release candidate under `next`, then `0.3.0` under `latest` only after the Windows live pilot. The public `v0.3.0-rc.1` tag is retained as failed release evidence after platform-specific gzip headers caused the detached asset build to reject the Throughline digest; `0.3.0-rc.2` is the replacement candidate.
- Main and tag verification for `v0.3.0-rc.1` passed on Ubuntu, macOS, and Windows before the separate release job exposed the cross-platform gzip-byte mismatch.
- ADR-0006 separates the embedded setup manifest from the detached release envelope so the ContextRail tarball never contains its own digest.
- Windows is the first external pilot host. Automated Windows CI belongs to implementation evidence; live Codex capture, restore, and handoff remain user-run acceptance evidence.
- The native Windows existing-project pilot installed every component but exposed two host-level gaps: Codex required manual trust for the three Throughline and two ContextRail Hook handlers, and `contextrail throughline verify --doctor` incorrectly searched `PATH` instead of the selected managed release.
- The rc.3 candidate resolves standalone verification and doctor commands through the selected managed Node/JavaScript paths and documents the in-place existing-project continuation flow.
- Release commit and annotated tag: `a5254f6` / `v0.3.0-rc.3`; npm `next` and the GitHub versioned asset are byte-identical at SHA-256 `64478972cd2bc2a6db9c7a0fa67a4f7c0a451d8c78247b8a1ddadff7cbb37d50`.
- The first rc.3 release-triggered OIDC publish reached `npm publish` but npm rejected it before a Trusted Publisher existed. The exact verified tarball was then published manually with account 2FA, and npm Trusted Publisher ID `85ffcaa4-1e45-4fe7-9c4b-79a45f22cc18` now binds `jeongyeop91/ContextRail` workflow `publish.yml`; the automated OIDC path remains unverified until a future release.
- The Windows Codex config contains persisted trust hashes for all three Throughline handlers and both ContextRail handlers. Throughline `0.10.3-codex.1` falsely reports `0/3 trusted` because its doctor parser accepts only TOML basic-string Hook state keys, while Codex emits literal-string keys for Windows paths.
- The compatibility fix is covered by a failing-then-passing upstream doctor regression and reproducibly packages as managed Throughline `0.10.3-codex.2` with SHA-256 `29053de08c4ec074c2e02f724314f91e7359a48fb79f7feadaceb7de7f594fd9`.
- Release commit and annotated tag: `de40523` / `v0.3.0-rc.4`; npm `next` and the GitHub versioned asset are byte-identical at SHA-256 `78eb266278d39d2c4a3bb30eb2244e748fec4150e956520f04c66e458851f89b`.
- The rc.4 release-triggered npm workflow published successfully through the configured OIDC Trusted Publisher. Main and tag verification passed; the separate release build reached only its final create step and reported failure because the same prerelease had already been created manually with the verified assets.

## Next steps

1. Update the existing `C:\Projects\RathonSales` installation in place to `0.3.0-rc.4` / managed Throughline `0.10.3-codex.2` without recreating its adoption mapping.
2. Verify ContextRail live routing plus Throughline capture, restore, and handoff after any updated Throughline Hook commands are trusted in Codex Desktop.
3. Retain the Windows live gate for npm `latest`; leave CR-004 outside the active scope.

## Blockers

- None. GitHub authentication for `jeongyeop91` is active with repository scope.
