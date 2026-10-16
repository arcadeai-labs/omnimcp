# Repository controls

This tree mirrors `ArcadeAI/arcade-plugin`. Package files match that
repository at the Source-SHA recorded on the sync commit and pull request.
Canonical commits are not imported.

These canonical paths are intentionally absent:

- `.github/workflows/`
- `scripts/sync-legacy.mjs`
- `scripts/legacy-projection.mjs`
- `scripts/verify-mirror.mjs`
- `test/sync-legacy.test.mjs`
- `test/mirror-integrity.test.mjs`
- `sync/`
- `docs/migration/`

Destination controls are projected from these canonical templates:

- `sync/destination-check.yml` -> `.github/workflows/check.yml`
- `scripts/legacy-projection.mjs` -> `.github/legacy-projection.mjs`
- `scripts/verify-mirror.mjs` -> `.github/verify-mirror.mjs`

This file is destination-only. Sync keeps it and does not replace it.

The pre-migration tree used the Apache-2.0 license. Those obsolete paths
are removed when the canonical tree is copied. Their notices remain in git
history. Files copied from the canonical package keep that package's MIT notice.

This tree does not change the existing legacy listing. The Claude
marketplace stays `arcade` with plugin `arcade` at `source: "./"`, and
the marketplace owner keeps `support@arcade.dev`.
Existing and hub installs use this repository. New installs use
`ArcadeAI/arcade-plugin`. Do not add both in one Claude profile: they
share the marketplace name `arcade`.
