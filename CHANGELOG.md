# Changelog

All notable changes to the Omni Cursor plugin are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-04

### Added

- Initial release of the Omni by Arcade Cursor plugin.
- Hosted MCP server connection to `https://omni.arcade.dev/mcp` (OAuth via
  RFC 9728 Protected Resource Metadata, delegated to Arcade/Ory).
- Bundled rule (`rules/omni-tool-discovery.mdc`) teaching the
  `Arcade_SelectTools → Arcade_UseTool` flow, the `Toolkit_Action` naming
  convention, and authorization handling.
