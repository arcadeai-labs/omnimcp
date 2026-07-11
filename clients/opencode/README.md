# opencode-arcade

Arcade ([OmniMCP](https://omni.arcade.dev)) for **OpenCode** — instant access to
500+ external-service tools (Slack, Gmail, GitHub, Google Calendar, Notion,
Linear, Dropbox, and more) over a single MCP connection. Just ask for what you
want; Arcade picks the right tool and handles the app sign-in.

## Install

One command:

```bash
opencode plugin opencode-arcade
```

Or add it to your `opencode.json` (`plugin` array) yourself:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-arcade"]
}
```

The plugin registers the `arcade` remote MCP server for you (OAuth is
auto-discovered — no API keys) and shows a toast with the one-time sign-in link
the first time an app needs connecting. Run `opencode mcp auth arcade` if it
doesn't prompt automatically.

Prefer configuring the MCP server yourself instead of using the plugin? Add:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "arcade": { "type": "remote", "url": "https://omni.arcade.dev/mcp", "enabled": true }
  }
}
```

## What you get

Four meta-tools that resolve to the full Arcade catalog on demand:

- `Arcade_SelectTools` — find the right tool for a task
- `Arcade_UseTool` — run it
- `Arcade_Apps` — see or disconnect your connected apps
- `Arcade_ManageToolAuthorization` — fix an app connection (switch account,
  expired sign-in, missing permissions)

## Links

- Home: https://omni.arcade.dev
- Endpoint: https://omni.arcade.dev/mcp
- Source: https://github.com/arcadeai-labs/omnimcp

## License

[Apache-2.0](LICENSE). Copyright (c) 2024–Present Arcade AI.
