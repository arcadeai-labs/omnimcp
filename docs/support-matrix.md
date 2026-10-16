# Client support matrix

Every install below connects to the same gateway,
`https://api.arcade.dev/mcp/arcade`. Sign-in happens in the
browser. The rows differ in how much of this plugin the client can load.

## Everything at a glance

| Client | Tools | Skills | Subagent | Commands | Rule | Hooks | Install |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| **Cursor IDE / Cloud Agents** | ✅ | ✅ | ✅ | ✅¹ | ✅ | —² | [guide](install/cursor.md) |
| **Cursor CLI** | ✅ | ✅ | ✅ | ✅ | — | ✅³ | [guide](install/cursor.md) |
| **Claude Code (CLI and desktop Code tab)** | ✅ | ✅ | ✅ | ✅ | — | ✅ | [guide](install/claude-code.md) |
| **Claude Cowork** | ✅ | ✅ | ✅ | ✅ | — | partial⁴ | [guide](install/claude-code.md) |
| **GitHub Copilot CLI** | ✅ | ✅ | ✅ | — | — | ✅⁵ | [guide](install/copilot.md) |
| **VS Code** | ✅ | ✅ | ✅ | — | — | —⁶ | [guide](install/vscode.md) |
| **Codex / ChatGPT local runtime** | ✅ | ✅ | — | — | — | —⁷ | [guide](install/codex.md) |
| **OpenCode** | ✅ | — | — | — | — | — | [guide](install/opencode.md) |
| **Claude Desktop** | ✅ | ✅ | — | — | — | — | [guide](install/claude-desktop.md) |
| **Any MCP client** | ✅ | — | — | — | — | — | [guide](install/agent-plugins.md) |

Hooks add the routing rules at session start, to each prompt, and to
subagents. In the Hooks column, ✅ means the session-start hook runs, so the
full rules reach the main conversation. Partial means some hooks run but the
session-start text doesn't reach the main conversation. The files are
`.claude-plugin/hooks.json` (Claude Code),
`clients/cursor/hooks/hooks.json` (Cursor CLI), and
`com.github.copilot/hooks/hooks.json` (Copilot CLI).

¹ The Cursor IDE (3.21.18) lists the commands on the plugin page but not in
the `/` menu. Other plugins' commands don't appear there either.
² The IDE (3.21.18) and Cloud Agents don't run plugin hooks, so the
always-apply rule carries the full session rules. Cloud Agents run repo, team,
and enterprise hooks only; they get the rule and the skill.
³ Session hook only. The CLI runs the session hook (full rules) but doesn't
load the always-apply rule.
⁴ Cowork runs the prompt and subagent hooks but doesn't add the session-start
text, so its main conversation gets the short reminder and the skill, not the
full rules.
⁵ Copilot CLI drops the output of prompt hooks from config files, so it gets
session and subagent hooks only.
⁶ VS Code reads `com.github.copilot/hooks/hooks.json` but doesn't expand
`${PLUGIN_ROOT}` for Agent Plugins hooks or pass their output to the model yet.
⁷ Blocked upstream; see [codex.md](install/codex.md).

Skills are `try-arcade` and `scale-arcade`. The subagent is
`arcade-operator`. In Cursor the commands are `/arcade-apps`,
`/arcade-connect`, and `/arcade-status`. In Claude Code they appear as
`/arcade:arcade-apps`, `/arcade:arcade-connect`, and
`/arcade:arcade-status`.

Only skills and MCP servers are portable component types in
[Agent Plugins](https://agent-plugins.org) 1.0. Commands, the operator,
hooks, and the Cursor rule are client-specific, which is why those columns
thin out.

## Where each client finds the pieces

Files a client needs at its own path are generated from shared sources (see
[ARCHITECTURE.md](../ARCHITECTURE.md)).

| Piece | File | Read by |
|---|---|---|
| Skills | `skills/` | every client with skills |
| MCP server | `mcp.json` | VS Code, Copilot CLI, Codex |
| MCP server | inline in `.cursor-plugin/plugin.json` / `.claude-plugin/plugin.json` | Cursor / Claude Code |
| Operator | `agents/arcade-operator.agent.md` | Cursor, Claude Code, Cowork |
| Operator (generated copy) | `com.github.copilot/agents/arcade-operator.agent.md` | Copilot CLI, VS Code |
| Commands | `commands/arcade-*.md` | Cursor, Claude Code, Cowork |
| Rule | `clients/cursor/rules/arcade.mdc` | Cursor IDE / Cloud Agents |
| Marketplace | `.claude-plugin/marketplace.json` | Claude Desktop, Cowork, Claude Code, Codex |
| Codex listing | `plugin.json` → `extensions.com.openai.interface` | Codex |

Claude Desktop installs this repo as a plugin marketplace (see
[claude-desktop.md](install/claude-desktop.md)): add
`ArcadeAI/arcade-plugin`, then install `arcade@arcade`. Chat gets tools
and skills. A custom connector with the gateway URL is the tools-only
fallback. There is no `.mcpb` Desktop Extension.

## Tools-only installs

A one-click MCP link (or pasting the gateway URL) connects tools only. Skills
and the operator need the plugin install. Cursor and VS Code links are in
[cursor.md](install/cursor.md) and [vscode.md](install/vscode.md); any other
MCP client can use `https://api.arcade.dev/mcp/arcade`.
