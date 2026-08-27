# Continuity

## Files

- `state/CURRENT.md` is the short handoff: active item, observed state, completed evidence, next steps, and blockers.
- `state/PLAN.md` is the single active multi-step implementation plan.
- `state/BACKLOG.json` is structured work memory with acceptance and validation argv.

## Backlog contract

IDs are unique. Supported statuses are `proposed`, `ready`, `in_progress`, `blocked`, `done`, and `dropped`. Dependencies reference existing IDs and form an acyclic graph. At most one item is `in_progress`, and it must match CURRENT.

Each item contains a title, status, dependency IDs, acceptance statements, authority paths, source hints, next steps, and validation commands represented as arrays of argv arrays. Shell command strings are not accepted.

## Continue semantics

`continue` reads instructions and state but performs no model call, test, Git mutation, or file write. A valid active item is returned deterministically. If CURRENT has no active item, a single unambiguous `ready` item may be proposed. Missing, conflicting, done, or multiple candidates return `needs_input` with stable issue codes.

CURRENT stays concise enough to read at session start and must distinguish observed facts from planned work.
