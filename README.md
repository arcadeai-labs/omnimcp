# OmniMCP by Arcade.dev

Give your AI assistant instant access to 500+ everyday tools — Slack, Gmail,
GitHub, Google Calendar, Notion, Linear, Dropbox, and more — over a single
connection. Just ask for what you want; OmniMCP picks the right tool, handles
sign-in, and gets it done.

Endpoint: `https://omni.arcade.dev/mcp`

This repo packages client plugins for the hosted Omni MCP server (the server
itself is a separate codebase): a **Cursor plugin**, a **Claude Code / Cowork
plugin**, a **Claude Desktop** connector, and an **OpenCode** plugin. One-click
installers also live on the splash page — **[omni.arcade.dev](https://omni.arcade.dev)**.

The first time you connect you sign in with Arcade. After that, each app
(Google, GitHub, Slack, …) prompts a one-time sign-in the first time it's used.
No API keys to paste.

## The tools

Every client gets the same four meta-tools, which resolve to the full Arcade
catalog on demand:

- `Arcade_SelectTools` — find the right tool for a task
- `Arcade_UseTool` — run it
- `Arcade_Apps` — see or disconnect your connected apps
- `Arcade_ManageToolAuthorization` — fix an app connection (switch account,
  expired sign-in, missing permissions)

The plugins add guidance (skills, a rule), slash commands, an operator
subagent, and session hooks on the clients that support them.

## Cursor

**Tools only (one click):**

[![Add arcade MCP server to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=arcade&config=eyJ1cmwiOiJodHRwczovL29tbmkuYXJjYWRlLmRldi9tY3AifQ==)

This adds the `arcade` MCP server only — no rule, skills, commands, or hooks.
Approve the install, then open **Settings → MCP**, find **arcade**, and sign in
with Arcade.

**Full plugin** (rule + skills + commands + subagent + hook): pending Cursor
Marketplace listing. To load it locally today, copy or symlink this repo to
`~/.cursor/plugins/local/arcade` and restart Cursor.

## Claude Code (CLI)

```bash
/plugin marketplace add arcadeai-labs/omnimcp   # register this repo as a marketplace
/plugin install arcade@arcade                   # install the plugin
/mcp                                            # sign in to the "arcade" server
```

Then just ask in plain language, or use the commands:

- `/arcade:do <task>` — do something in an app (Slack, Gmail, GitHub, …)
- `/arcade:apps` — see, disconnect, or fix your connected apps
- `/arcade:tools <query>` — preview which tools would run (debugging)

Want only the tools (no commands/skills/subagent)? Add the bare server instead:

```bash
claude mcp add --transport http arcade https://omni.arcade.dev/mcp
```

## Claude in the desktop app (Cowork & Code)

Plugins work in **Cowork** and **Code** (not plain Chat).

1. Open the **Plugins** page → **Add marketplace**.
2. Enter `arcadeai-labs/omnimcp` (or `https://github.com/arcadeai-labs/omnimcp`).
3. **Install** the **arcade** plugin and sign in with Arcade when prompted.

You get the same commands, skills, and operator subagent as Claude Code.

For plain **Chat** (which doesn't use plugins), connect the server directly:
**Settings → Connectors → Add custom connector** → paste
`https://omni.arcade.dev/mcp` (requires a paid Claude plan). That gives the tools
only — no slash commands. If your version lacks custom connectors, merge
[`clients/claude-desktop/claude_desktop_config.json`](clients/claude-desktop/claude_desktop_config.json)
into your `claude_desktop_config.json` and restart (requires Node; uses a
pinned `mcp-remote` stdio proxy).

## OpenCode

The [`opencode-arcade`](https://www.npmjs.com/package/opencode-arcade) plugin is
published on npm. One command:

```bash
opencode plugin opencode-arcade
```

It registers the `arcade` MCP server for you (OAuth is auto-discovered — no
keys) and shows app sign-in links as toasts. Run `opencode mcp auth arcade` if
it doesn't prompt automatically.

Prefer configuring the MCP server yourself? Add to `opencode.json` (project) or
`~/.config/opencode/opencode.json` (global):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "arcade": { "type": "remote", "url": "https://omni.arcade.dev/mcp", "enabled": true }
  }
}
```

(Ready-made: [`clients/opencode/opencode.json`](clients/opencode/opencode.json).)

## Try it

- "Send a Slack message to #eng that the deploy is done."
- "What's on my calendar tomorrow?"
- "Open a GitHub issue in arcadeai-labs/omnimcp titled 'flaky CI'."
- "Summarize my unread email from today."

## What's in this repo

One shared core plus a small adapter per client. Every manifest declares its
component paths explicitly — nothing loads by folder convention.

| Path | What it is | Used by |
|------|------------|---------|
| `components/skills/` | `using-arcade-tools`, `managing-arcade-apps` skills | Cursor + Claude Code / Cowork |
| `components/agents/` | The `arcade-operator` subagent | Cursor + Claude Code / Cowork |
| `components/commands/` | `/arcade:do`, `/arcade:apps`, `/arcade:tools` | Cursor + Claude Code / Cowork |
| `clients/cursor/` | Rule, Cursor-native session hook, MCP config | Cursor |
| `clients/claude/` | Claude-native session hook, MCP config | Claude Code / Cowork |
| `clients/claude-desktop/` | Ready-to-merge connector config (pinned `mcp-remote`) | Claude Desktop Chat |
| `clients/opencode/` | The `opencode-arcade` npm plugin + MCP server config | OpenCode |
| `.cursor-plugin/` / `.claude-plugin/` | Plugin + marketplace manifests | Cursor / Claude |

## Privacy

Tasks run through Arcade's hosted Omni server (`omni.arcade.dev`) and the apps
you connect. See [Arcade's privacy policy](https://www.arcade.dev/privacy-policy)
for how data is handled.

## Links

- Home: https://omni.arcade.dev
- Endpoint: https://omni.arcade.dev/mcp
- Plugin source: https://github.com/arcadeai-labs/omnimcp

## License

[Apache-2.0](LICENSE). Copyright (c) 2024–Present Arcade AI.
