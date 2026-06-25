# Changelog

All notable changes to the OmniMCP plugin are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-25

### Added

- **Claude Code plugin** (`.claude-plugin/`): installable via
  `/plugin marketplace add arcadeai-labs/omnimcp`.
  - Subagents (`agents/`): `arcade-operator` (general), `inbox-agent` (email),
    and `schedule-agent` (calendar) run the discovery loop in an isolated
    context so it never clutters the main conversation.
  - Skills (`skills/`): `arcade-tool-use` and `arcade-authorization`.
  - Slash commands (`commands/`): `/arcade`, `/arcade-tools`, `/arcade-auth`.
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
