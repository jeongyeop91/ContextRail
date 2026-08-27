# Contributing

ContextRail is currently preparing its first public release. The project license must be selected before external contributions are accepted.

## Development contract

1. Read `AGENTS.md`, `docs/README.md`, and the relevant Active Authority.
2. Locate the current backlog item and keep changes narrowly scoped.
3. Add a failing focused test before changing behavior.
4. Run the focused test, then `npm test`.
5. Run `npm run verify` before requesting review.

Use Node.js 22.13 or newer and do not add a production dependency without an accepted ADR. Keep core behavior independent of network access, global packages, and Throughline.

Do not commit raw conversations, transcripts, secrets, personal absolute paths, runtime measurement data, generated package archives, copied Rathon material, or the full Throughline source.

## Documents and state

- Keep `docs/README.md` at or below 50 lines.
- Keep every `docs/authority/*.md` file at or below 500 lines and linked from the router.
- Put durable decisions in `docs/adr/`.
- Keep only one active `state/PLAN.md`.
- Express backlog validation as argv arrays, never shell strings.

## Integration changes

Throughline changes must preserve immutable source and patch hashes, its MIT notice, temporary-HOME tests, plan-first installation, and read-only ordinary verification. Never test an apply path against a contributor's real HOME.
