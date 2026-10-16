# Install in Claude Desktop

Add this repository as a plugin marketplace, then install Arcade. Claude
Desktop looks for `.claude-plugin/marketplace.json` — not a `.mcpb`
Desktop Extension, and not a one-click deeplink.

> **Personal trial.** Sign in with Arcade when prompted in the browser.

## Plugin (recommended)

**Customize → Plugins → Add marketplace → Add from a repository** → paste:

```text
ArcadeAI/arcade-plugin
```

Then install **Arcade** (`arcade@arcade`).

From Claude Code in the desktop app, or a terminal:

```bash
claude plugin marketplace add ArcadeAI/arcade-plugin
claude plugin install arcade@arcade
```

Then run **`/reload-plugins`** if Claude Code was already open.

Chat gets tools and skills. Cowork and Code also get the operator,
commands, and hooks. There is no documented `claude://` link that adds a
marketplace; the steps above are the install.

## Tools only

If you only want the gateway, skip the marketplace:

**Settings → Connectors → Add custom connector** → paste:

```text
https://api.arcade.dev/mcp/arcade
```

## First steps

- "What's on my calendar tomorrow?"
- `/try-arcade`
- "What apps can Arcade use?"
