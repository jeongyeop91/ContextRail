# CR-008 cross-platform full installation

**Goal:** Implement the accepted ADR-0003, ADR-0004, and ADR-0005 installation and distribution contracts.

**Status:** Approved for execution with npm release-candidate publication under `next`; stable `latest` promotion remains gated on Windows live evidence.

Detailed task plan: `docs/superpowers/plans/2026-08-27-cross-platform-full-install.md`

Current follow-up plan: `docs/superpowers/plans/2026-08-31-human-cli-and-hook-diagnostics.md`

- [x] Add verified release metadata and portable Throughline execution.
- [x] Add cross-platform Codex Hook registration.
- [x] Implement plan-first, resumable `contextrail setup` with TTY confirmation.
- [x] Build and test GitHub Release assets across Ubuntu, macOS, and Windows CI.
- [x] Publish the verified `0.3.0-rc.3` tarball to npm under `next`; configure Trusted Publishing for future releases.
- [x] Publish `0.3.0-rc.4` with the Windows Hook-trust diagnostic fix and verify the OIDC Trusted Publishing path.
- [x] Publish `0.3.0-rc.5` with the post-approval Hook receipt ownership fix.
- [x] Publish `0.3.0-rc.6` with the managed Throughline upgrade ownership fix.
- [x] Publish `0.3.0-rc.7` with the resumable ContextRail Hook receipt refresh fix.
- [x] Publish `0.3.0-rc.8` with resilient Windows setup progress receipt replacement.
- [x] Publish `0.3.0-rc.9` with Codex Desktop app-server executable discovery.
- [x] Implement concise human setup/doctor output, explicit debug evidence, canonical Hook feature migration, bounded Stop diagnostics, and one-command managed handoff.
- [x] Publish the updated README and implementation as `0.3.0-rc.10`.
- [x] Prepare project-neutral Throughline handoff defaults and the `0.3.0-rc.11` release candidate.
- [x] Publish `0.3.0-rc.11` under npm `next` with the matching GitHub prerelease.
- [x] Correct stale Codex Hook approval diagnosis and prepare the `0.3.0-rc.12` release candidate.
- [x] Publish `0.3.0-rc.12` under npm `next` with the matching GitHub prerelease.
- [ ] Rerun the Windows semantic handoff pilot and promote npm `latest` only after the evidence passes.
