# npm Registry Distribution Design

## Purpose

Publish ContextRail as the public unscoped npm package `contextrail` so the primary installation becomes:

```text
npm install --global contextrail
contextrail setup
```

The npm package distributes the ContextRail CLI. It does not vendor the patched Throughline artifact. Full setup continues to select, download, and SHA-256 verify the pinned Throughline asset from the matching GitHub Release.

## Release sequence

The first registry version is `0.3.0-rc.1` with the `next` dist-tag. It is published only after CR-008 implements the complete setup flow and automated verification passes.

```text
source tag v0.3.0-rc.1
  -> repository verification
  -> GitHub Release assets and checksums
  -> packed CLI installation smoke
  -> npm contextrail@0.3.0-rc.1 with dist-tag next
  -> Windows live Codex pilot
  -> source tag v0.3.0
  -> repeated verification
  -> npm contextrail@0.3.0 with dist-tag latest
```

The release candidate is installed with `npm install --global contextrail@next`. Unqualified `npm install --global contextrail` is documented only after the stable version receives `latest`.

Registry versions are immutable. A failed or defective publication is deprecated with a corrective message and replaced by a higher version; it is not overwritten or treated as reusable after unpublish.

## Package contract

`package.json` changes from `private: true` to publishable public metadata only in the release implementation. It retains:

- package name `contextrail`;
- the `contextrail` executable mapped to `bin/contextrail.mjs`;
- Node.js `>=22.13` runtime support;
- MIT licensing and the exact public GitHub repository URL;
- an allowlist in `files` for runtime, templates, integration metadata, notices, and user documentation; and
- zero production npm dependencies unless a later accepted decision changes the Core boundary.

`publishConfig.access` is `public`. The package does not set a permanent dist-tag in `package.json`; the release command selects `next` or `latest` explicitly so release channels cannot drift implicitly.

The published tarball must not contain repository state, tests, local runtime data, generated release artifacts, credentials, npm configuration, raw prompts, transcripts, or maintainer-specific paths.

## First publication and trusted publishing

Trusted Publishing configuration is package-scoped, so initial registration is a controlled bootstrap:

1. finish and tag `v0.3.0-rc.1`;
2. run full verification and inspect `npm pack --dry-run --json`;
3. install the exact tarball into an isolated prefix and run version, help, Core, and setup dry-run smoke checks;
4. run `npm publish --dry-run --access public --tag next`;
5. publish the exact verified tarball manually with publishing 2FA using `npm publish <tarball> --access public --tag next`;
6. confirm package metadata, owners, digest, files, and the `next` dist-tag from the public registry;
7. configure the npm Trusted Publisher for the public GitHub repository and `.github/workflows/publish.yml`; and
8. use OIDC publication for subsequent prerelease and stable versions.

No npm authentication token is committed or stored as a GitHub secret. The trusted workflow uses `id-token: write`, `contents: read`, Node.js 24, a compatible npm CLI, no dependency cache in the release job, and the exact repository metadata required for automatic provenance.

The first manual publication is the only credential bootstrap. If npm supports creating the Trusted Publisher before the package exists at execution time, the workflow may replace the manual publish, but it must still preserve the same reviewed tarball and tag boundaries.

## GitHub and npm artifact relationship

The ContextRail tarball published to npm and the versioned ContextRail tarball attached to the GitHub Release must be byte-identical. The stable-name GitHub asset `contextrail.tgz` is another byte-identical copy for the non-registry fallback.

The release manifest records the ContextRail package digest and the separate Throughline artifact digest. Verification compares:

- locally packed tarball SHA-256;
- GitHub Release ContextRail asset SHA-256;
- npm registry distribution integrity and unpacked identity;
- embedded release manifest version; and
- CLI-reported version.

A mismatch stops publication. The npm install path and GitHub install path must produce the same CLI behavior and resolve the same immutable Throughline release metadata.

## Workflow safety

`.github/workflows/publish.yml` is tag-triggered and verifies that the tag exactly matches `package.json` version before publishing. Prerelease versions publish with `next`; stable versions publish with `latest`. Any other version shape fails closed.

The workflow runs repository verification, packs once, inspects the allowlisted package contents, performs an isolated packed-artifact smoke, and publishes that exact tarball. It does not run `npm publish` directly from an independently repacked checkout.

GitHub Environment protection may require manual approval for the `npm-production` environment. Stable publication additionally requires recorded Windows live pilot evidence. The workflow must not infer live evidence from CI or synthetic Hook tests.

## Failure handling

- Name unavailable at publication: stop and return to design; do not silently switch to a scoped or similarly spelled package.
- Authentication or 2FA failure: leave all registry state unchanged and provide the exact retry command.
- Tarball, digest, provenance, owner, or dist-tag mismatch: stop stable promotion and deprecate a published defective candidate if necessary.
- GitHub Release succeeds but npm fails: retain the immutable GitHub release, correct the registry issue, and retry the same unpublished version only when npm confirms that version was never accepted.
- npm succeeds but GitHub verification fails: do not move `latest`; deprecate the candidate and issue a higher prerelease after correction.

## Documentation

Before stable promotion, README presents both channels:

```text
# Release candidate
npm install --global contextrail@next

# Audited GitHub fallback
npm install --global https://github.com/jeongyeop91/ContextRail/releases/download/v0.3.0-rc.1/contextrail-0.3.0-rc.1.tgz
```

After Windows acceptance, the first command becomes `npm install --global contextrail`. Upgrade, uninstall, profile selection, and `contextrail setup` behavior remain identical across channels.

## Acceptance

- `contextrail@0.3.0-rc.1` is public under `next` and installs the verified CLI tarball.
- The npm tarball and GitHub versioned/stable-name ContextRail assets are byte-identical.
- No long-lived npm token exists in the repository or GitHub Actions secrets for publication.
- Registry and GitHub installation paths pass the same isolated setup dry-run smoke on Ubuntu, macOS, and Windows CI.
- `latest` is absent or remains on the last stable version until Windows live evidence is recorded.
- After the Windows pilot, `contextrail@0.3.0` is published with `latest` and the README uses the registry two-command quickstart.

