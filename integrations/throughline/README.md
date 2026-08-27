# Throughline compatibility integration

This directory contains no vendored Throughline source. It stores an immutable upstream base, a separately hashed compatibility patch, the upstream MIT license, and the tests needed to prepare an installable artifact in a temporary directory.

`source.json` is the execution contract. Preparation checks out only the pinned base, verifies HEAD, checks and applies the patch, runs focused and upstream tests, then creates an npm tarball. A dry run prints this plan without cloning or writing HOME.

Throughline remains optional. ContextRail core validation, routing, continuation, scaffolding, and measurement do not import or invoke it.

The patch may be removed only after an immutable upstream release contains equivalent current Codex rollout support and the same capture verification passes.
