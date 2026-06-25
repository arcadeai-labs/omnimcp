# OmniMCP by Arcade.dev

Give your AI assistant instant access to 500+ everyday tools — Slack, Gmail,
GitHub, Google Calendar, Notion, Linear, Dropbox, and more — over a single
connection. Just ask for what you want; OmniMCP picks the right tool, handles
sign-in, and gets it done.

Endpoint: `https://omni.arcade.dev/mcp`

This repo is one package that works as a **Cursor plugin**, a **Claude Code
plugin**, and a **Claude Desktop** connector. The quickest one-click installers
also live on the splash page — **[omni.arcade.dev](https://omni.arcade.dev)**.

## Cursor

[![Add arcade MCP server to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=arcade&config=eyJ1cmwiOiJodHRwczovL29tbmkuYXJjYWRlLmRldi9tY3AifQ==)

Or install the plugin from the Cursor Marketplace, or add the server manually:
**Cursor Settings → MCP → Add server**, then use the endpoint above.

## Claude Code

Install the plugin to get the operator subagent, skills, and slash commands:

```bash
/plugin marketplace add arcadeai-labs/omnimcp
/plugin install arcade
/mcp        # authenticate "arcade" with Arcade
```

Or just add the bare connection (no subagents/commands):

```bash
claude mcp add --transport http arcade https://omni.arcade.dev/mcp
```

Once installed, try `/omni summarize my unread email`, or just ask in plain
language — the `omni-operator` subagent kicks in automatically.

## Claude Desktop

**Settings → Connectors → Add custom connector**, then paste the endpoint above.
(Requires a paid Claude plan.)

No connector support on your version? Use the config in
[`clients/claude-desktop/claude_desktop_config.json`](clients/claude-desktop/claude_desktop_config.json)
— merge its `mcpServers` entry into your `claude_desktop_config.json` and
restart Claude Desktop.

## Signing in

The first time you connect, you'll sign in with Arcade. After that, whenever a
tool needs one of your accounts (Google, GitHub, Slack, …), you'll get a
one-time link to connect it — approve it once and you're set. No API keys to
paste.

## Try it

- "Send a Slack message to #eng that the deploy is done."
- "What's on my calendar tomorrow?"
- "Open a GitHub issue in arcadeai-labs/omnimcp titled 'flaky CI'."
- "Summarize my unread email from today."

## What's in this repo

One plugin, three client targets, sharing the same MCP connection:

| Path | Used by | What it is |
|------|---------|------------|
| `.cursor-plugin/` | Cursor | Plugin + marketplace manifest |
| `.claude-plugin/` | Claude Code | Plugin + marketplace manifest |
| `mcp.json` / `.mcp.json` | Cursor / Claude Code | The Omni MCP server connection |
| `agents/` | Claude Code | Subagents that run the discovery loop in isolation |
| `skills/` | Cursor + Claude Code | Auto-activating guidance for tool use & auth |
| `commands/` | Claude Code | `/omni`, `/omni-tools`, `/omni-auth` slash commands |
| `hooks/` | Claude Code | Session-start priming + auth-link surfacing |
| `rules/` | Cursor | Tool-discovery rule |
| `clients/claude-desktop/` | Claude Desktop | Ready-to-merge connector config |

## Links

- Home: https://omni.arcade.dev
- Endpoint: https://omni.arcade.dev/mcp
- Plugin source: https://github.com/arcadeai-labs/omnimcp

## License

[Apache-2.0](LICENSE). Copyright (c) 2024–Present Arcade AI.
