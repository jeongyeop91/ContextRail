# CR-008 cross-platform full installation

**Goal:** Implement the accepted ADR-0003, ADR-0004, and ADR-0005 installation and distribution contracts.

**Status:** Approved for execution with npm release-candidate publication under `next`; stable `latest` promotion remains gated on Windows live evidence.

Detailed task plan: `docs/superpowers/plans/2026-08-27-cross-platform-full-install.md`

- [ ] Add verified release metadata and portable Throughline execution.
- [ ] Add cross-platform Codex Hook registration.
- [ ] Implement plan-first, resumable `contextrail setup` with TTY confirmation.
- [ ] Build and test GitHub Release assets across Ubuntu, macOS, and Windows CI.
- [x] Publish the verified `0.3.0-rc.3` tarball to npm under `next`; configure Trusted Publishing for future releases.
- [x] Publish `0.3.0-rc.4` with the Windows Hook-trust diagnostic fix and verify the OIDC Trusted Publishing path.
- [x] Publish `0.3.0-rc.5` with the post-approval Hook receipt ownership fix.
- [x] Publish `0.3.0-rc.6` with the managed Throughline upgrade ownership fix.
- [x] Publish `0.3.0-rc.7` with the resumable ContextRail Hook receipt refresh fix.
- [ ] Publish the two-command README and Windows live pilot checklist.
