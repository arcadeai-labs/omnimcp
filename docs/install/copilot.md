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

Hooks come from `com.github.copilot/hooks/hooks.json`: routing rules at
session start and for subagents. Copilot CLI drops the output of prompt hooks
from config files, so there's no per-prompt reminder here. VS Code's Copilot
sessions use the same hook implementation and manifest for session and subagent
routing guidance; see the [VS Code guide](vscode.md) for harness/version scope
and validation limits.

## Telemetry

Telemetry is **off** in this build: generated manifests include no telemetry
hooks and nothing is sent. When enabled, `hooks/telemetry-adapters/copilot-cli.mjs`
records MCP tools as `<server>-<tool>`, operator stops with `subagent_session`,
and session-scoped prompt state under `COPILOT_PLUGIN_DATA` (no `turn`, no
`PreToolUse`, no built-in CLI/web events). See
[telemetry.md](../telemetry.md) for opt-outs (`ARCADE_PLUGIN_TELEMETRY=0` and
`COPILOT_OFFLINE`) and
[what CI exercises](../telemetry.md#what-ci-exercises).

Shared `com.github.copilot/hooks/hooks.json` uses `runOnlyIfScriptExists` to
exit quietly when the plugin path or script is missing.

## First steps

- "What's on my calendar tomorrow?"
- `/try-arcade`
