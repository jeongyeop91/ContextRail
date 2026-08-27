## Summary

Describe the user-visible problem and the smallest coherent change that solves it.

## Validation

List the exact commands run and their observed results.

```text
npm test
npm run check
npm run smoke:template
npm run verify
```

## Checklist

- [ ] I read `AGENTS.md`, `docs/README.md`, and the relevant Active Authority.
- [ ] I added or updated focused tests for behavior changes.
- [ ] I preserved plan-first writes, path confinement, and user-owned files.
- [ ] I did not commit secrets, personal paths, private project content, raw transcripts, runtime measurements, or package archives.
- [ ] I kept `docs/README.md` at or below 50 lines and each Active Authority file at or below 500 lines.
- [ ] I updated documentation and file memory when the next session would otherwise need reconstruction.
- [ ] I ran the listed validation commands and recorded any degraded external integration honestly.
