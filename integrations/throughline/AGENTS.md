# Throughline integration instructions

- Treat Throughline as optional and independently versioned.
- Store only provenance, its license, a reproducible compatibility patch, and synthetic fixtures.
- Pin immutable commit and patch hashes; do not depend on mutable branches.
- Preparation and installation must be plan-first, bounded to temporary or managed roots, and explicit.
- Verification must use documented Throughline interfaces; do not read its database directly.
- Never copy or vendor the full Throughline source tree.
