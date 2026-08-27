# Operating model

## Default loop

1. Search names and identifiers before reading files.
2. Locate the nearest instructions, routed authority, current item, and affected code.
3. Read bounded regions needed to decide the change.
4. Modify the smallest coherent surface.
5. Run targeted validation, then broaden only when risk warrants it.
6. Update file memory when the next session would otherwise need reconstruction.

## Context selection

Root `AGENTS.md` applies everywhere. A nested `AGENTS.md` applies to its subtree and may refine the root. Routing returns files in root-to-target order so later instructions are nearer and more specific.

Authority documents define current contracts. References explain; ADRs record durable decisions; history preserves completed evidence; generated documents must be reproducible. Runtime observations do not become authority automatically.

## Tool use

- Prefer exact repository searches and bounded reads over directory-wide ingestion.
- Prefer deterministic local tools before network calls.
- Express executable commands as argv arrays at trust boundaries.
- Use a subagent only for independent work with explicit scope, inputs, output, and verification.
- Never allow parallel work to edit the same files without coordination.

## Change discipline

Write-capable operations expose a plan or dry run. Existing user files are skipped or marked as conflicts unless ownership and prior content hashes prove that an upgrade is safe. External installation always needs explicit apply.
