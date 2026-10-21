# Install in GitHub Copilot CLI

## Full plugin

```bash
copilot plugin marketplace add ArcadeAI/arcade-plugin
copilot plugin install arcade@arcade
```

The cross-client CLI works too; it runs Copilot's own `copilot plugin`
commands for you:

```bash
npx plugins add ArcadeAI/arcade-plugin --target github-copilot
```

Restart or `/restart` your Copilot session after install.

Copilot CLI reads the portable Agent Plugins components (`plugin.json`,
`skills/`, and `mcp.json`) and its custom agent from
`com.github.copilot/agents/arcade-operator.agent.md`. You get 2 skills, the
gateway, and `arcade-operator`.

This release does not register `com.github.copilot/hooks/hooks.json`. Copilot
CLI and VS Code still load the skills, the gateway, and `arcade-operator`.

## Telemetry

Telemetry is **off** in this build: generated manifests include no telemetry
hooks and nothing is sent. When enabled, `hooks/telemetry-adapters/copilot-cli.mjs`
records MCP tools as `<server>-<tool>`, operator stops with `subagent_session`,
and session-scoped prompt state under `COPILOT_PLUGIN_DATA` (no `turn`, no
`PreToolUse`, no built-in CLI/web events). See
[telemetry.md](../telemetry.md) for opt-outs (`ARCADE_PLUGIN_TELEMETRY=0` and
`COPILOT_OFFLINE`) and
[what CI exercises](../telemetry.md#what-ci-exercises).

## First steps

- "What's on my calendar tomorrow?"
- `/try-arcade`
