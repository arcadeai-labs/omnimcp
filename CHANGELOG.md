# Changelog

All notable changes to the OmniMCP plugin are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-07-10

### Changed

- **Explicit layout.** Shared components moved to `components/` (skills, agent,
  commands) and client adapters to `clients/{cursor,claude,claude-desktop,opencode}/`.
  Both plugin manifests now declare every component path explicitly — nothing
  loads by folder convention, so each client gets exactly its intended bundle.
- **Client-native hooks.** Cursor gets its own `sessionStart` hook
  (Cursor-native flat schema) instead of silently ingesting the Claude hook;
  the Claude `SessionStart` hook is unchanged in shape. Both hooks trimmed to a
  two-sentence context; detailed behavior lives in the skills.
- **Sign-in correctness.** Rule, skills, and subagent now state explicitly that
  an `authorization_url` in a tool result means sign-in required **even when
  the response says `success: true`** — present the link, stop, wait, retry
  once.
- **App connection repair.** `managing-arcade-apps` and `/arcade:apps` now
  document fixing connections via `Arcade_ManageToolAuthorization`
  (status / switch account / sign in again) with apps language.
- **Action safety in the direct path.** Confirm-before-send/delete/cancel/
  overwrite/publish guidance moved into the shared skill and Cursor rule, not
  just the `arcade-operator` subagent.
- **OpenCode hardening** (`opencode-arcade@0.6.0`): `@opencode-ai/plugin`
  pinned (`^1.17.18`), package `exports` added, and the sign-in toast is now
  scoped to Arcade tool executions with structured `authorization_url` parsing
  (regex is a fallback only) — unrelated OAuth-looking URLs no longer toast.
- **Truthful docs.** Cursor deeplink labeled tools-only with the full plugin
  path documented separately; four meta-tools documented (including
  `Arcade_ManageToolAuthorization`); OpenCode npm publication status corrected;
  `mcp-remote` pinned for Claude Desktop; privacy note added; remaining
  "authorization link" copy renamed to "sign-in link".

> Claude Code/Cowork users: run `/plugin marketplace update arcade`, then
> reinstall/update the `arcade` plugin to pick up the new layout.

## [0.5.0] - 2026-07-10

### Changed

- **Reliability pass over skills and the Cursor rule**, following skill-authoring
  best practices (Anthropic's guide, the agentskills.io spec, OpenAI's Codex
  skills docs): trigger keywords front-loaded in descriptions, an explicit
  "reach for Arcade first" preference over built-in web search / CLI / direct
  API calls, "when not to use" sections, worked input→output examples, a
  defined error policy (fix inputs and retry once, otherwise report the error
  verbatim; never fabricate), and the `arcade` MCP server named explicitly.
  The Cursor rule and Claude skills now use identical wording where they
  overlap.

### Removed

- **`inbox-agent` and `schedule-agent` subagents.** Their descriptions fully
  overlapped with `arcade-operator` (which also names Gmail and Google
  Calendar), so they were rarely selected; their domain rules (confirm before
  sending email, resolve relative dates and confirm before changing events)
  moved into `arcade-operator`. One agent, one command, two skills.

## [0.4.0] - 2026-06-26

### Added

- **OpenCode** client target (`clients/opencode/`): an `opencode-arcade` plugin
  package (npm-style: `package.json` + `index.ts`, per the OpenCode ecosystem
  convention) that registers the Arcade remote MCP server via the `config` hook
  and surfaces app sign-in links as toasts (`client.tui.showToast`); plus a
  ready-made `opencode.json` for configuring the MCP server directly. OAuth is
  auto-discovered (no keys). README now documents Cursor, Claude Code/Cowork,
  Claude Desktop, and OpenCode.

## [0.3.0] - 2026-06-26

### Added

- **`/arcade:apps` command** and **`managing-arcade-apps` skill** for managing
  connected apps: list the apps Arcade can act on (with the account each is
  connected as) and disconnect one. Backed by the new `Arcade_Apps` MCP tool on
  the Omni server (`list` + `disconnect`).

### Changed

- User-facing copy across commands, agents, the skill, the rule, and the README
  now uses **apps** language (app, connected, disconnect, sign in) instead of
  authorization/OAuth/scopes/providers.

### Removed

- **`/arcade:auth` command** — removed outright (no alias). App management now
  lives in `/arcade:apps`; on-demand sign-in still surfaces inline during tasks.
- **PostToolUse auth-surfacing hook** (`hooks/post-tool-surface-auth.mjs` + its
  `hooks.json` block) — its `mcp__arcade__Arcade_UseTool` matcher never fired
  under plugin MCP namespacing. The `SessionStart` hook is unchanged.
- **`arcade-authorization` skill** — replaced by `managing-arcade-apps`; the
  general guidance skill was renamed `arcade-tool-use` -> `using-arcade-tools`.

> Requires reinstalling the plugin to pick up the new command set
> (`/plugin marketplace update arcade` then reinstall). The `/arcade:apps`
> disconnect/list actions require `Arcade_Apps` to be live in the connected Omni
> server.

## [0.2.1] - 2026-06-25

### Fixed

- Subagents no longer fabricate results. Their `tools:` allowlist used
  `mcp__arcade__*`, but a plugin-bundled MCP server is namespaced
  (`plugin:arcade:arcade`), so the allowlist matched no tools and the subagents
  had no way to call them. Removed the `tools:` restriction so subagents inherit
  the MCP tools, and added an explicit no-fabrication guard.
- Renamed the slash command stems to `do`/`tools`/`auth` so they read as
  `/arcade:do`, `/arcade:tools`, `/arcade:auth` instead of the redundant
  `/arcade:arcade` (plugin commands are scoped as `plugin:command`).

## [0.2.0] - 2026-06-25

### Added

- **Claude Code plugin** (`.claude-plugin/`): installable via
  `/plugin marketplace add arcadeai-labs/omnimcp`.
  - Subagents (`agents/`): `arcade-operator` (general), `inbox-agent` (email),
    and `schedule-agent` (calendar) run the discovery loop in an isolated
    context so it never clutters the main conversation.
  - Skills (`skills/`): `arcade-tool-use` and `arcade-authorization`.
  - Slash commands (`commands/`): `/arcade:do`, `/arcade:tools`, `/arcade:auth`.
  - Hooks (`hooks/`): session-start availability priming and post-tool
    authorization-link surfacing.
- **Claude Desktop** connector config (`clients/claude-desktop/`).
- Shared `.mcp.json` for Claude Code alongside the existing Cursor `mcp.json`.

### Changed

- The plugin is now installed and referenced as `arcade` across all clients
  (Cursor, Claude Code, Claude Desktop), and the MCP server key is `arcade`
  (Claude Code tools are `mcp__arcade__Arcade_*`).
- README now covers all three client targets (Cursor, Claude Code, Claude
  Desktop) and documents the repo layout.

## [0.1.0] - 2026-06-04

### Added

- Initial release of the Omni by Arcade Cursor plugin.
- Hosted MCP server connection to `https://omni.arcade.dev/mcp` (OAuth via
  RFC 9728 Protected Resource Metadata, delegated to Arcade/Ory).
- Bundled rule (`rules/omni-tool-discovery.mdc`) teaching the
  `Arcade_SelectTools → Arcade_UseTool` flow, the `Toolkit_Action` naming
  convention, and authorization handling.
