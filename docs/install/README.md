# Install Arcade

> **Personal trial.** This plugin is for trying Arcade in your agent — personal
> use and evaluation. For org rollout (Okta, project gateways, tool policy),
> use the `scale-arcade` skill and the [Arcade dashboard](https://app.arcade.dev).

## Quick install

Each client has its own install; use the one for yours. The per-client guides
below have alternatives and verification steps.

| Client | Install | Instructions |
|---|---|---|
| **Cursor** | [![Install in Cursor](https://img.shields.io/badge/Cursor-one--click-000000)](https://cursor.com/install-mcp?name=arcade&config=eyJ1cmwiOiJodHRwczovL2FwaS5hcmNhZGUuZGV2L21jcC9hcmNhZGUifQ==) | [cursor.md](cursor.md) |
| **Claude Code** | `claude plugin marketplace add ArcadeAI/arcade-plugin`, then `claude plugin install arcade@arcade` | [claude-code.md](claude-code.md) |
| **Claude Desktop** | Add `ArcadeAI/arcade-plugin` as a plugin marketplace | [claude-desktop.md](claude-desktop.md) |
| **VS Code** | [![Install in VS Code](https://img.shields.io/badge/VS_Code-one--click-0098FF?logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect/mcp/install?name=arcade&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fapi.arcade.dev%2Fmcp%2Farcade%22%7D) | [vscode.md](vscode.md) |
| **GitHub Copilot CLI** | `copilot plugin install ArcadeAI/arcade-plugin` | [copilot.md](copilot.md) |
| **Codex / ChatGPT** | `codex plugin marketplace add ArcadeAI/arcade-plugin`, then `codex plugin add arcade@arcade` | [codex.md](codex.md) |
| **OpenCode** | Gateway URL only — [opencode.md](opencode.md) | [opencode.md](opencode.md) |
| **Any MCP client** | `https://api.arcade.dev/mcp/arcade` | [agent-plugins.md](agent-plugins.md) |

Cursor and VS Code one-click badges add the gateway only, without skills or
the operator. For the full plugin:

- **Cursor:** individual plans clone `https://github.com/ArcadeAI/arcade-plugin`
  into `~/.cursor/plugins/local/arcade-plugin`; Teams/Enterprise use an
  admin-imported team marketplace. See [cursor.md](cursor.md).
- **VS Code:** Command Palette → **Chat: Install Plugin From Source** →
  `https://github.com/ArcadeAI/arcade-plugin`. See [vscode.md](vscode.md).

After install, reload your agent or start a new session. No API keys: the
first task that touches an app returns a browser sign-in link.

### About `npx plugins add`

The cross-client CLI ([`plugins`](https://www.npmjs.com/package/plugins),
checked at 1.3.4) auto-detects clients by their command-line tools and installs
into each. Today it only finishes the job for some of them:

| Client | What `npx plugins add` does |
|---|---|
| Claude Code | Installs and enables the plugin. Works. |
| GitHub Copilot CLI | Runs `copilot plugin marketplace add` and `copilot plugin install`. |
| Codex | Copies the plugin and enables it in `config.toml`, but `codex plugin list` shows it as not installed until you run `codex plugin add arcade@plugins-cli`. |
| Cursor (macOS, Linux) | Writes into Claude Code's plugin folder (`~/.claude/plugins`), not Cursor's. With **Include third-party Plugins, Skills, and other configs** off, Cursor doesn't load it at all; with it on, Cursor gets the Claude Code manifest instead of the Cursor adapter. |
| VS Code | Adds a `chat.pluginLocations` entry pointing at a copy under `~/.cache/plugins/`, and does not turn on `chat.plugins.enabled`. |

It also skips any client whose command-line tool (`cursor`, `code`, …) isn't on
your `PATH`.

For developing this repo, install a local checkout into Claude Code, or preview
what the CLI would install:

```bash
npx plugins add /path/to/arcade-plugin --target claude-code
npx plugins discover ArcadeAI/arcade-plugin
```

## Tools only

Need just the MCP gateway, without skills or the operator?

```text
https://api.arcade.dev/mcp/arcade
```

**Claude Desktop:** add `ArcadeAI/arcade-plugin` as a plugin marketplace
(see [claude-desktop.md](claude-desktop.md)). A custom connector with the URL above is
the tools-only fallback.

Cursor and VS Code also have one-click MCP install links in
[cursor.md](cursor.md) and [vscode.md](vscode.md).

## Per-client guides

| Client | Guide |
|---|---|
| Cursor | [cursor.md](cursor.md) |
| Claude Code / Cowork | [claude-code.md](claude-code.md) |
| Claude Desktop | [claude-desktop.md](claude-desktop.md) |
| VS Code | [vscode.md](vscode.md) |
| GitHub Copilot CLI | [copilot.md](copilot.md) |
| Codex / ChatGPT | [codex.md](codex.md) |
| OpenCode | [opencode.md](opencode.md) |
| Any MCP / Agent Plugins client | [agent-plugins.md](agent-plugins.md) |

What each client actually loads is in the [support matrix](../support-matrix.md).
