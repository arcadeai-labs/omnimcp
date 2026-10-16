# Install in any MCP client

Any client that can call a Streamable HTTP MCP server can use Arcade tools:

```text
https://api.arcade.dev/mcp/arcade
```

That path is tools only.

Clients that implement [Agent Plugins](https://agent-plugins.org) 1.0 can
load the full plugin — `plugin.json`, `skills/`, and `mcp.json`, which give you
`try-arcade`, `scale-arcade`, and the gateway. Install it the way your client
installs plugins; the [install guides](README.md) cover each supported client.
The cross-client `npx plugins add ArcadeAI/arcade-plugin` doesn't finish the
job for every client yet (see
[About `npx plugins add`](README.md#about-npx-plugins-add)).

The operator is not a portable Agent Plugins component. Cursor, Claude Code,
and Cowork load it from `agents/`; Copilot CLI and VS Code load a generated copy
from `com.github.copilot/agents/`. Other clients run the same loop in the
parent skill.

## First steps

- "What's on my calendar tomorrow?"
- Invoke skills the way your client supports them (for example `/try-arcade` in
  Cursor and Claude Code, or `@Arcade` / `$arcade:try-arcade` in Codex — see
  [codex.md](codex.md))
