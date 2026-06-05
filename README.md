# Omni by Arcade — Cursor Plugin

[Omni](https://omni.arcade.dev) is Arcade's MCP server for **dynamic tool
discovery and execution**. This plugin connects Cursor to the full Arcade tool
catalog — Slack, GitHub, Gmail, Google Calendar, Notion, Linear, and hundreds
more — without any per-tool configuration. The agent discovers the right tool at
runtime, authorizes it on demand, and runs it.

## What you get

- A hosted MCP server connection to `https://omni.arcade.dev/mcp` (no local
  install, no API keys to paste).
- A small meta-tool surface the agent uses to reach every tool in the catalog:
  - **`Arcade_SelectTools`** — semantic search by task; returns matching tools
    with their input schemas inline.
  - **`Arcade_UseTool`** — execute a discovered tool.
  - **`Arcade_ManageToolAuthorization`** — reconnect a provider, switch
    accounts, or fix OAuth scopes.
- A bundled rule that teaches the agent the `SelectTools → UseTool` flow and the
  `Toolkit_Action` tool-naming convention.

## Authentication

The hosted endpoint uses OAuth via RFC 9728 Protected Resource Metadata,
delegating to Arcade/Ory as the authorization server.

1. After installing, open **Cursor Settings → MCP** and connect the **omni**
   server. Cursor opens an Arcade sign-in / authorize page.
2. Once authorized, the agent can discover and run tools.
3. The first time a tool needs a provider (Google, GitHub, Slack, ...), it
   returns a one-time authorization link. Complete it, then ask the agent to
   retry.

No `ARCADE_API_KEY` or `ARCADE_USER_ID` is required for the hosted endpoint —
your identity comes from the OAuth session.

## Installation

### From the Cursor Marketplace

Search for **"Omni by Arcade"** in the Cursor Marketplace panel and install.

### Manual / local testing

This directory is a complete Cursor plugin. To test it before publishing, point
Cursor at it as a local plugin source (see the
[Cursor plugin docs](https://cursor.com/docs/plugins)), or simply add the server
to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "omni": {
      "type": "http",
      "url": "https://omni.arcade.dev/mcp"
    }
  }
}
```

## Usage

Just ask for the outcome — the agent handles discovery and execution silently:

- "Send a Slack message to #eng that the deploy is done."
- "What's on my Google Calendar tomorrow?"
- "Open a GitHub issue in arcadeai-labs/omnimcp titled 'flaky CI'."
- "Summarize my unread Gmail from today."

Omni finds the right tool, prompts for authorization the first time a provider
is used, and returns the result.

## Tool reference

| Tool | Purpose |
|------|---------|
| `Arcade_SelectTools(tasks, context?, top_k?)` | Semantic tool search; returns `{tool_name, description, input_schema}`. |
| `Arcade_UseTool(tool_name, inputs, query_id?)` | Execute a tool by its `Toolkit_Action` name. |
| `Arcade_ManageToolAuthorization` | Inspect/repair provider authorization; reconnect or switch accounts. |

See the [plugin repository](https://github.com/arcadeai-labs/omnimcp) for more
details and to file issues.

## Links

- Hosted endpoint: https://omni.arcade.dev/mcp
- Arcade: https://arcade.dev
- Plugin source: https://github.com/arcadeai-labs/omnimcp

## License

[Apache-2.0](LICENSE). Copyright (c) 2024–Present Arcade AI.
