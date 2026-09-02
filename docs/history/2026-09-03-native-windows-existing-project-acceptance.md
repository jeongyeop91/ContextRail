# Native Windows existing-project acceptance

Date: 2026-09-03

## Scope

This record captures the bounded acceptance result for installing ContextRail
into an existing repository on native Windows. It intentionally excludes raw
prompts, conversation bodies, transcripts, secrets, personal paths, and
runtime metrics.

## Validated versions

- ContextRail: `0.3.0-rc.13`
- Managed Throughline: `0.10.3-codex.5`
- Node.js: `24.13.1`
- Codex Desktop: installed; exact application version was not reported
- Windows edition and architecture: not reported

## Results

- Reviewed existing-repository adoption: pass
- Resumable full setup and managed Throughline installation: pass
- Preservation of non-owned Hooks: pass
- Codex Hook registration and user trust: pass
- ContextRail prompt routing and Stop dispatch: pass
- Automatic Throughline capture of a completed Codex turn: pass
- Fresh Codex task creation: pass
- Developer-memory injection into the fresh task: pass
- Project-specific handoff restoration without unrelated memory: pass
- Option-free `contextrail handoff` opening Codex Desktop: pass

No stable ContextRail issue code remained at the end of the pilot. Host-level
rollback and inject behavior outside the exercised guarded setup and fresh-task
handoff paths was not promoted into a broader compatibility claim.

## Stable-release decision

The native Windows acceptance gate for stable `0.3.0` is satisfied. Automated
Ubuntu, macOS, and Windows checks remain required for the stable release in
addition to this user-run native validation.
