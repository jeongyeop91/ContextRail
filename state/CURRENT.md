# Current state

Active item: `CR-006`

## Observed

- Existing-repository adoption is implemented on `main` and preserves mapped project-owned files.
- MIT and the `v0.1.0` public release defaults are approved for `jeongyeop91/ContextRail`.
- The `0.1.0` package is locally verified in an isolated HOME, npm cache, and prefix; external publication and global installation have not started.
- The local ContextRail MVP is implemented on `main` with no remote configured.
- Core operation is independent of Throughline and has no production npm dependencies.
- The compatibility patch is pinned to immutable Throughline source and patch hashes with its MIT notice.
- The user's Throughline installation was verified read-only as `degraded`: capture, restore, and handoff are ready; Codex hooks are not ready.
- No real Throughline preparation, installation, rollback, HOME edit, remote creation, or push was performed.

## Completed evidence

- Architecture: `b3859b5`; execution plan: `4bf5c32`.
- Foundation: `5ac86bb`; validation: `8a3003d`; workflow: `34625ba`.
- Measurement: `2f5e932`; Throughline preparation: `2c472c9`; managed integration: `da2ee55`.
- Existing-repository profile: `c9da4ca`; reference authority and state mapping: `74df134`.
- Security read-only dry-run at `930b6ee1220e5cb2ce443efd1f76066ac2a69f30` planned only the three `.context-rail` metadata creates; HEAD and clean status were unchanged afterward.
- Final verification: 66 tests passed; self-check found 8 Active Authority files; neutral template smoke passed; `git diff --check` passed.
- Release-candidate verification: 69 tests passed; `npm run verify`, `npm pack --dry-run`, and isolated package version/help/init/check/adoption smoke passed.

## Next steps

1. Commit the locally verified `v0.1.0` release preparation.
2. Create and push the approved public GitHub Template Repository and `v0.1.0` release.
3. Install the verified release artifact globally and run Security read-only checks.

## Blockers

- None. GitHub authentication for `jeongyeop91` is active with repository scope.
