# ContextRail agent guide

## Start here

1. Read `docs/README.md` and only the authority documents it routes for the task.
2. Read `state/CURRENT.md`, then locate the matching item in `state/BACKLOG.json`.
3. Follow `search -> locate -> bounded read -> modify -> targeted validation`.
4. Keep `state/CURRENT.md` current when work spans sessions.

## Repository rules

- Instructions nest: a nearer `AGENTS.md` adds to or overrides this file for its subtree.
- Active Authority is `docs/authority/*.md`; each file must stay at or below 500 lines.
- `docs/README.md` is a routing index, not a handbook, and must stay at or below 50 lines.
- Decisions belong in `docs/adr/`; evidence and finished plans belong in `docs/history/`.
- Never commit raw prompts, transcripts, secrets, personal absolute paths, or runtime metrics.
- Core operation must not require Throughline, a network, or a global package.
- Write-capable commands must plan first and require an explicit apply boundary.

## Validation

- Run the narrowest test that covers a change before the full suite.
- Run `npm test` for behavior changes.
- Run `npm run verify` before claiming repository-wide completion.
- Report degraded external integrations as degraded, never as passing.

## Tools and delegation

- Prefer repository-local tools and argv arrays over shell command strings.
- Use search before opening large files; read only the relevant bounded region.
- Delegate only independent, clearly bounded work with explicit inputs and validation.
- Preserve user changes and keep referenced repositories read-only.
