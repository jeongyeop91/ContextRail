# ADR-0006: Detached release envelope

- Status: accepted
- Date: 2026-08-27

## Context

ADR-0003 says the ContextRail package embeds the same release manifest that publishes the release assets, while ADR-0005 requires that manifest to record the ContextRail tarball digest. A tarball cannot contain a file that records the digest of the complete tarball containing that file: inserting the digest changes the tarball and therefore changes the digest again.

The release still needs a package-local, offline-readable selection contract for the separate Throughline asset and an external record that lets users verify every published asset.

## Decision

The release uses two linked documents instead of a self-referential manifest.

The ContextRail package embeds `integrations/setup-manifest.json`. It pins:

- its schema and ContextRail release version;
- supported Node.js version and operating systems;
- the immutable Throughline asset URL and SHA-256;
- Throughline source, compatibility, and patch provenance; and
- the compatibility-patch removal condition.

The GitHub Release publishes `release-manifest.json` as a detached envelope. It records:

- the SHA-256 of the byte-identical npm, versioned GitHub, and stable-name GitHub ContextRail tarball;
- the SHA-256 of the exact embedded `setup-manifest.json` bytes;
- the Throughline artifact URL and SHA-256 copied from the embedded setup manifest; and
- the source tag, package version, and generated checksum-file identity.

The detached envelope is generated only after the ContextRail tarball exists. It is never inserted back into that tarball. Verification extracts or reads the embedded setup manifest, checks it against the envelope digest, and then checks both published tarballs and the Throughline artifact.

The npm and GitHub ContextRail tarballs remain byte-identical. Runtime setup trusts only the embedded Throughline selection after validating its schema and package-version agreement. The detached envelope is release evidence and is not required for offline Core commands.

## Superseded clauses

This decision supersedes only the ADR-0003 sentence requiring the package to embed the same release manifest used to publish assets and any ADR-0005 wording that implies the ContextRail tarball contains its own digest. All other release, checksum, setup, and distribution decisions remain accepted.

## Consequences

There is no circular digest. The two manifests have distinct responsibilities and a one-way integrity relationship: detached envelope to embedded setup manifest to Throughline artifact. Release tests must prove the envelope and embedded document agree and that the three ContextRail distribution copies are byte-identical.

