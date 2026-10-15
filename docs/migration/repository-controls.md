# Repository controls

This tree mirrors `ArcadeAI/arcade-plugin`. Package files match that
repository at the Source-SHA recorded on the sync commit and pull request.
Canonical commits are not imported.

These canonical paths are intentionally absent:

- `.github/workflows/release-please.yml`
- `scripts/sync-legacy.mjs`
- `test/sync-legacy.test.mjs`
- `sync/`
- `docs/migration/`

This file is destination-only. Sync keeps it and does not replace it.

The pre-migration tree used the Apache-2.0 license. Those obsolete paths
are removed when the canonical tree is copied. Their notices remain in git
history. Files copied from the canonical package keep that package's MIT notice.

This tree does not change the existing legacy listing.
