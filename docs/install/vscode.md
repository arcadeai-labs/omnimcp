# Install in VS Code

## Full plugin (recommended)

Command Palette → **Chat: Install Plugin From Source** → paste:

```text
https://github.com/ArcadeAI/arcade-plugin
```

Enable agent plugins in VS Code if needed (`chat.plugins.enabled`). Reload the
VS Code window after install and confirm the plugin under **Agent Plugins →
Installed**. The first time, run **MCP: List Servers**, pick **arcade**, choose
**Start Server**, and sign in when prompted; its tools show up after that.

VS Code loads root `plugin.json` as an Agent Plugin: 2 skills, the gateway,
and `arcade-operator` from `com.github.copilot/agents/`. It does not read the
`.cursor-plugin/` adapter. No lifecycle hooks: VS Code doesn't yet run Agent
Plugins hook commands with the plugin's path or pass their output to the model.

If you already installed the plugin via Copilot CLI, VS Code may auto-discover
it from `~/.copilot/installed-plugins/`. Install in one place.

### Local checkout

Add the absolute path of your checkout to `chat.pluginLocations` in settings
(see [VS Code Agent Plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins)).

## Tools only (one click)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-one--click-0098FF?logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect/mcp/install?name=arcade&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fapi.arcade.dev%2Fmcp%2Farcade%22%7D)

This adds the gateway only — no skills.

## First steps

- "What's on my calendar tomorrow?"
- `/try-arcade`
