# Install in GitHub Copilot CLI

## Full plugin

```bash
copilot plugin install ArcadeAI/arcade-plugin
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
from config files, so there's no per-prompt reminder here. VS Code reads the
same file but can't run Agent Plugins hook commands yet, so it relies on the
skills.

## First steps

- "What's on my calendar tomorrow?"
- `/try-arcade`
