# ADR-0005: npm registry distribution

- Status: accepted
- Date: 2026-08-27

## Context

ADR-0004 deliberately made npm registry publication optional and defined a GitHub Release tarball as the first quickstart command. The npm account is now available, the unscoped `contextrail` name is not currently registered, and the user approved registry publication as part of CR-008.

Registry publication must simplify installation without weakening the release-manifest, Throughline separation, plan-first setup, or live Windows acceptance contracts. npm package versions are immutable, and subsequent automated publication should not depend on a long-lived registry token.

## Decision

ContextRail will publish the public unscoped npm package `contextrail`.

The first registry version is the completed full-install release candidate `0.3.0-rc.1`, published under the `next` dist-tag. The current `0.2.0` package is not published merely to reserve the name because it does not provide the approved full setup flow. Windows users test with:

```text
npm install --global contextrail@next
contextrail setup
```

After the recorded Windows Codex pilot passes, `0.3.0` is published under `latest`, and the primary README command becomes:

```text
npm install --global contextrail
```

The npm package contains only the ContextRail CLI and its allowlisted runtime files. The patched Throughline tarball remains a separate GitHub Release asset selected by the embedded release manifest and verified by SHA-256 during setup. The npm, versioned GitHub, and stable-name GitHub ContextRail tarballs are byte-identical.

Initial package registration uses a manually reviewed publication of the exact verified `0.3.0-rc.1` tarball with publishing 2FA and `--tag next`. After registration, npm Trusted Publishing is bound to `.github/workflows/publish.yml`. Subsequent publication uses GitHub Actions OIDC with provenance and no long-lived npm token. The workflow selects `next` for prereleases and `latest` for stable versions, verifies tag/package version equality, and publishes the already tested tarball rather than repacking independently.

Published versions are never overwritten. A defective version is deprecated and replaced by a higher version. Stable promotion remains blocked until the Windows live evidence required by ADR-0003 is recorded.

## Consequences

The final onboarding flow matches the familiar npm global-install experience while retaining GitHub Releases as the audited fallback and Throughline artifact host. The first publication needs a one-time manual bootstrap before Trusted Publishing can own later releases. Release verification must prove artifact identity across both distribution channels.

The registry name remains unclaimed until the full-install release candidate is ready. If another publisher claims it first, implementation stops and returns to a naming decision rather than silently changing the public package identity.

## Detailed specification

See `docs/superpowers/specs/2026-08-27-npm-registry-distribution-design.md`.

