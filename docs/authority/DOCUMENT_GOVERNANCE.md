# Document governance

## Classes

- `docs/README.md`: routing index; maximum 50 lines.
- `docs/authority/*.md`: active, normative contracts; maximum 500 lines each and indexed by the router.
- `docs/adr/*.md`: accepted or superseded decisions; immutable except status and links.
- `docs/reference/**`: non-authoritative explanatory material.
- `docs/history/**`: completed plans and evidence snapshots.
- `docs/generated/**`: reproducible generated artifacts, never hand-edited authority.
- `state/**`: current operational memory governed by the continuity contract.

## Link and path rules

Repository Markdown links must resolve to an existing file or an existing heading anchor. Relative links may not escape the repository. External links are allowed but offline validation does not fetch them.

Committed content must not contain raw transcripts, secrets, host-specific absolute paths, or copied product material. Examples use neutral identifiers and relative paths.

## Growth rule

When an authority file approaches its limit, keep the contract concise and move examples or explanation to reference material. Split authority only when each resulting document has a distinct routing purpose. The router remains a table of contents rather than a summary corpus.
