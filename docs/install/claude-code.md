# Install in Claude Code

## Full plugin

**Anthropic-native (matches Claude Code docs):**

```bash
claude plugin marketplace add ArcadeAI/arcade-plugin
claude plugin install arcade@arcade
```

Then in Claude Code run **`/reload-plugins`**.

**Cross-client CLI:**

```bash
npx plugins add ArcadeAI/arcade-plugin --target claude-code
```

Verify with `claude plugin list` or **`/plugin`**, then **`/reload-plugins`**
if the session was already open.

Claude Code reads `.claude-plugin/plugin.json` for the gateway and
`.claude-plugin/hooks.json`. Skills, `arcade-operator`, and commands load from
the default `skills/`, `agents/`, and `commands/` folders. The manifest has no
`agents` field on purpose: Cowork rejects the `.md` paths the CLI needs.

The same folder works in Claude Cowork / Claude Code desktop once the plugin
is enabled there. In Claude Desktop Chat, add this GitHub repo as a
marketplace instead — see [claude-desktop.md](claude-desktop.md).

## Multiple Arcade MCP servers

This plugin registers one MCP server named **`arcade`** → `api.arcade.dev`.
If your host has other Arcade MCP connectors too, Claude may pick the wrong one
(same tool names, different gateway). In `/mcp`, confirm **`arcade`** is
connected and prefer disabling other Arcade connectors while testing this
plugin.

## Telemetry

Telemetry is **off** in this build (`TELEMETRY_ENABLED` is `false`): no usage
events are sent and generated manifests include no telemetry hooks. When
telemetry is enabled, the adapter in `hooks/telemetry-adapters/claude-code.mjs`
classifies prompts, records `PreToolUse` on the plugin and claude.ai Arcade
prefixes, and stores scope under `CLAUDE_PLUGIN_DATA`. Opt out with
`ARCADE_PLUGIN_TELEMETRY=0`, `DISABLE_TELEMETRY`, or
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`. See
[telemetry.md](../telemetry.md) and
[what CI exercises](../telemetry.md#what-ci-exercises).

## First steps

- "What's on my calendar tomorrow?"
- `/try-arcade`
