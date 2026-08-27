# ADR-0002: Opt-in Codex context automation hooks

- Status: accepted
- Date: 2026-08-27

## Context

ContextRail can already route repository context, project continuation, and structural checks, but users must invoke those commands manually. Codex supports lifecycle hooks at user and project configuration layers. ContextRail needs one safe installation that can serve many repositories without making every repository own a second Codex hook file or requiring Throughline.

## Decision

Install two ContextRail-owned command handlers in the user Codex `hooks.json`: `UserPromptSubmit` for bounded route or continuation context and `Stop` for a read-only project check. Each handler records the absolute Node executable and ContextRail CLI paths, runs synchronously with a bounded timeout, and follows the documented Codex JSON input and output contracts.

Hook installation alone does not activate a repository. A repository opts in through `automation.codex.enabled` in its ContextRail config. Enable and disable operations may update only a config whose current hash matches the ownership manifest, and they update the config and its ownership hash as one guarded transition.

Installation and removal preserve all non-ContextRail handlers. A receipt records the exact owned entries, affected feature flag state, and before/after hashes. Removal refuses concurrent configuration changes instead of guessing which user edits to overwrite. Runtime hooks never persist prompts or transcripts and never execute validation hints.

## Alternatives

Project-local `.codex/hooks.json` files would avoid a user-level installer, but would duplicate hook definitions and trust review across repositories. A plugin-bundled hook would improve packaging, but would expand this release into plugin distribution and enablement. Both remain possible future adapters; neither is required for the first Codex automation release.

## Consequences

Users install the Codex integration once and enable projects separately. Existing Throughline and user hooks remain independent and ordered. Hook registration proves configuration only; synthetic smoke tests prove handler behavior, while live context injection still requires Codex trust and an observed user turn.
