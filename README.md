<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/arcade-wordmark-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/arcade-wordmark-light.svg">
    <img alt="Arcade" src="assets/arcade-wordmark-light.svg" width="340">
  </picture>
</p>

<h3 align="center">Plugin</h3>

<p align="center">
  Let any agent use Arcade. Ask for what you want and the right tool runs
  <br>across every app you've connected.
  <br>App sign-in happens in the browser. No API keys.
</p>

<p align="center">
  <a href="https://api.arcade.dev/mcp/arcade"><img alt="Endpoint" src="https://img.shields.io/badge/endpoint-api.arcade.dev%2Fmcp%2Farcade-ff5c37"></a>
  <a href="https://agent-plugins.org"><img alt="Agent Plugins 1.0.0" src="https://img.shields.io/badge/Agent_Plugins-1.0.0-4f46e5"></a>
  <a href="CHANGELOG.md"><img alt="Version" src="https://img.shields.io/github/v/release/arcadeai-labs/omnimcp?label=version&color=555"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-555"></a>
</p>

---

## Install

Every client below gets the same `arcade` MCP server at
`https://api.arcade.dev/mcp/arcade`. What else comes with it depends on the
client — the full breakdown is in the [support matrix](docs/support-matrix.md).

| Client | Install | Instructions |
|---|---|---|
| **Cursor** | [![Install in Cursor](https://img.shields.io/badge/Cursor-one--click-000000)](https://cursor.com/install-mcp?name=arcade&config=eyJ1cmwiOiJodHRwczovL2FwaS5hcmNhZGUuZGV2L21jcC9hcmNhZGUifQ==) | [cursor.md](docs/install/cursor.md) |
| **Claude Code** | [![Install in Claude Code](https://img.shields.io/badge/Claude_Code-install-d97757?logo=claude&logoColor=white)](docs/install/claude-code.md) | [claude-code.md](docs/install/claude-code.md) |
| **Claude Desktop** | [![Install in Claude Desktop](https://img.shields.io/badge/Claude_Desktop-marketplace-d97757?logo=claude&logoColor=white)](docs/install/claude-desktop.md) | [claude-desktop.md](docs/install/claude-desktop.md) |
| **VS Code** | [![Install in VS Code](https://img.shields.io/badge/VS_Code-one--click-0098FF?logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect/mcp/install?name=arcade&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fapi.arcade.dev%2Fmcp%2Farcade%22%7D) | [vscode.md](docs/install/vscode.md) |
| **GitHub Copilot CLI** | [![Install in Copilot CLI](https://img.shields.io/badge/Copilot_CLI-install-24292e?logo=githubcopilot&logoColor=white)](docs/install/copilot.md) | [copilot.md](docs/install/copilot.md) |
| **Codex / ChatGPT** | [![Install in Codex](https://img.shields.io/badge/Codex_·_ChatGPT-install-000000?logo=openai&logoColor=white)](docs/install/codex.md) | [codex.md](docs/install/codex.md) |
| **OpenCode** | [![Install in OpenCode](https://img.shields.io/badge/OpenCode-install-333333?logo=iterm2&logoColor=white)](docs/install/opencode.md) | [opencode.md](docs/install/opencode.md) |
| **Any MCP client** | `https://api.arcade.dev/mcp/arcade` | [agent-plugins.md](docs/install/agent-plugins.md) |

Cursor and VS Code one-click badges add the gateway only. The linked guide
installs the skills too.

This repository is already the Claude marketplace. From Claude Code:

```bash
claude plugin marketplace add arcadeai-labs/omnimcp
claude plugin install arcade@arcade
```

One command covers most other clients:

```bash
npx plugins add arcadeai-labs/omnimcp
```

It does not finish Cursor, VS Code, or Codex by itself. Use the table above
for those. The marketplace name is `arcade`. If you already installed
`arcadeai-labs/arcade` or `ArcadeAI/arcade-plugin`, do not add this one too:
Claude treats them as the same marketplace and the second install replaces
the first. Installing in both Claude Code and Cursor can also list Arcade
twice and split its components. See [cursor.md](docs/install/cursor.md).

## What each client gets

| | Tools | Skills | Subagent | Commands | Rule | Hooks |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **Cursor IDE / Cloud Agents** | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| **Cursor CLI** | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| **Claude Code** | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| **Claude Cowork** | ✅ | ✅ | ✅ | ✅ | — | — |
| **GitHub Copilot CLI** | ✅ | ✅ | ✅ | — | — | — |
| **VS Code** | ✅ | ✅ | ✅ | — | — | — |
| **Codex / ChatGPT** | ✅ | ✅ | — | — | — | — |
| **OpenCode** | ✅ | — | — | — | — | — |
| **Claude Desktop** | ✅ | ✅ | — | — | — | — |
| **Any MCP client** | ✅ | — | — | — | — | — |

Skills are `try-arcade` and `scale-arcade`. The subagent is `arcade-operator`.
Commands, hooks, and the Cursor rule are client-specific. Detail is in the
[support matrix](docs/support-matrix.md).

## Try it

- "What's on my calendar tomorrow?"
- "Summarize unread email from this week."
- "Draft a reply to that thread, then wait for me to send it."
- "What can Arcade do?"
- `/arcade-status` — check the gateway, sign-in, and connected apps
- `/arcade-connect google` — connect an app ahead of time
- `/arcade-apps` — see or disconnect connected apps

Your assistant speaks intent to Arcade. You see the useful result, a sign-in
link when an app isn't connected yet, and a confirmation prompt before
anything is sent, created, or deleted.

## Learn more

- [Install guides](docs/install/) — one page per client
- [Client support matrix](docs/support-matrix.md) — what each install gets
- [Arcade docs](https://docs.arcade.dev/en/home) — product, APIs, SDKs, and setup
- [Arcade dashboard](https://app.arcade.dev) — org rollout (`scale-arcade`)
- Privacy: tasks run through Arcade's hosted gateway and the apps you connect —
  [privacy policy](https://www.arcade.dev/privacy-policy/)

## Develop

Agents editing this repo should read [AGENTS.md](AGENTS.md).

```bash
npm ci
npm run verify
```

## License

[MIT](LICENSE). Copyright (c) 2024–Present Arcade AI.
