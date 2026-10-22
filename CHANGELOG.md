# Changelog

All notable changes to Arcade are documented here.
This project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.4] (2026-10-22)

### Bug Fixes

* no manifest names a bundled image: drop the Codex `logo` and `composerIcon` and the Cursor `logo` (GRO-664)
* remove the ChatGPT ZIP builder and the Claude install check from `dev/scripts`, which the directory flagged as forwarding credential environment variables (GRO-664)
* remove the Codex and Copilot install checks from `dev/scripts`; they pass environment variables into those CLIs the same way (GRO-664)

## [0.8.3] (2026-10-22)

### Bug Fixes

* removed the unused credential-forwarding workflow fixture (GRO-664)

## [0.8.2] (2026-10-21)

### Bug Fixes

* directory release registers only the SessionStart hook v0.6.0 already shipped, and telemetry no longer reads the process environment

## [0.8.0] (2026-10-20)

### Features

* mirror ArcadeAI/arcade-plugin 0.8.0: https://github.com/ArcadeAI/arcade-plugin/releases/tag/v0.8.0

### Bug Fixes

* keep the plugin's development packages, scripts, and tests in `dev/`, so installing it no longer installs them
* keep 0.7.1's directory fixes; Cursor's validator is now downloaded by CI instead of kept in the repository
* replace the old mirror check with typecheck, tests, and the ChatGPT ZIP build

## [0.7.1] (2026-10-19)

### Bug Fixes

* publish a directory-clean plugin: privacy policy URL, vendored Cursor validator, and no telemetry key or environment forwarding

## [0.7.0](https://github.com/ArcadeAI/arcade-plugin/compare/v0.3.0...v0.7.0) (2026-10-15)


### Miscellaneous Chores

* set the migration candidate one minor above legacy omnimcp 0.6.0 (GRO-583)

## [0.3.0](https://github.com/ArcadeAI/arcade-plugin/compare/v0.2.1...v0.3.0) (2026-10-13)


### Features

* **telemetry:** add default-off telemetry foundation (1/4, GRO-305) ([#26](https://github.com/ArcadeAI/arcade-plugin/issues/26)) ([6f4cdc7](https://github.com/ArcadeAI/arcade-plugin/commit/6f4cdc7695b1953cdb2b7d207e53e5abb9738d1c))
* **telemetry:** add the Claude Code telemetry adapter (2/4, GRO-305) ([#27](https://github.com/ArcadeAI/arcade-plugin/issues/27)) ([f2bb5c9](https://github.com/ArcadeAI/arcade-plugin/commit/f2bb5c945ae47d02117ee22bc99388d9659f3978))
* **telemetry:** add the Copilot CLI telemetry adapter and guard Copilot hooks in VS Code (3/4, GRO-305) ([#28](https://github.com/ArcadeAI/arcade-plugin/issues/28)) ([8f417b6](https://github.com/ArcadeAI/arcade-plugin/commit/8f417b680540012d984fb2868c5ea7267ff83129))

## [0.2.1](https://github.com/ArcadeAI/arcade-plugin/compare/v0.2.0...v0.2.1) (2026-10-06)


### Bug Fixes

* allow fallback to another authorized Arcade gateway ([#24](https://github.com/ArcadeAI/arcade-plugin/issues/24)) ([bc8f3dc](https://github.com/ArcadeAI/arcade-plugin/commit/bc8f3dc45559c39fe671cd11c12a2adb65ddc62e))

## [0.2.0](https://github.com/ArcadeAI/arcade-plugin/compare/v0.1.0...v0.2.0) (2026-09-24)


### ⚠ BREAKING CHANGES

* generate every client's files from one set of sources (GRO-353) ([#9](https://github.com/ArcadeAI/arcade-plugin/issues/9))

### Features

* generate every client's files from one set of sources (GRO-353) ([#9](https://github.com/ArcadeAI/arcade-plugin/issues/9)) ([7e44be9](https://github.com/ArcadeAI/arcade-plugin/commit/7e44be9eeacc1bc235059dc73478a754ed64813e))

## [0.1.0] - 2026-09-10

Initial public release of the Arcade Agent Plugin.

- `try-arcade` for external service tasks, with a first-use proof and recap.
  When there isn't a job yet, set the stage: what Arcade is, example asks,
  and what sign-in and confirmation look like. First-contact replies must
  include copyable example asks; a prompt-only greeting is not enough.
- `scale-arcade` for org-rollout guidance. Orient from the proven workflow,
  contrast this chat with a shared team gateway, and give a worked example
  before recommending a path.
- Optional `arcade-operator` host adapter.
- One Streamable HTTP Arcade Gateway in `mcp.json`
  (`https://api.arcade.dev/mcp/arcade`).
- Cursor and Claude adapters in `.cursor-plugin/`, `.claude-plugin/`, and
  `clients/`.
- Commands (`arcade-apps`, `arcade-connect`, `arcade-status`), session hooks,
  and a Cursor rule.
- Docs entry points for other Arcade product questions.
- Frame README and install docs for personal trial use.
- Centralize routing guidance, endpoint constants, and drift checks in CI.
- Improve Claude per-turn hook continuation heuristics and expand test coverage.
- Ship a Claude plugin marketplace catalog so Desktop installs from
  `ArcadeAI/arcade-plugin` instead of a `.mcpb` Desktop Extension.
