# OmniMCP by Arcade.dev

Give your AI assistant instant access to 500+ everyday tools — Slack, Gmail,
GitHub, Google Calendar, Notion, Linear, Dropbox, and more — over a single
connection. Just ask for what you want; OmniMCP picks the right tool, handles
sign-in, and gets it done.

Endpoint: `https://omni.arcade.dev/mcp`

## Add it to your assistant

The quickest way is the one-click buttons on the splash page —
**[omni.arcade.dev](https://omni.arcade.dev)** (Cursor, VS Code, and more).

### Cursor

[![Add omni MCP server to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=omni&config=eyJ1cmwiOiJodHRwczovL29tbmkuYXJjYWRlLmRldi9tY3AifQ==)

Or: **Cursor Settings → MCP → Add server**, then use the endpoint above.

### Claude Code

```bash
claude mcp add --transport http omni https://omni.arcade.dev/mcp
```

### Claude Desktop

**Settings → Connectors → Add custom connector**, then paste the endpoint above.
(Requires a paid Claude plan.)

More clients and one-click installers are listed on
[omni.arcade.dev](https://omni.arcade.dev).

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

## Links

- Home: https://omni.arcade.dev
- Endpoint: https://omni.arcade.dev/mcp
- Plugin source: https://github.com/arcadeai-labs/omnimcp

## License

[Apache-2.0](LICENSE). Copyright (c) 2024–Present Arcade AI.
