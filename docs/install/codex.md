# Install in Codex or the ChatGPT local runtime

Codex and the ChatGPT local runtime share one plugin directory, so a single
local install shows up on both surfaces. You get the Arcade gateway and both
skills. Installing the plugin on the web does not deploy hook scripts.

Arcade is not in OpenAI's public Plugins Directory. Add it from GitHub with
one of the install paths below.

Codex does not load `arcade-operator` from the plugin. OpenAI plugins can ship
skills and MCP, but not custom agent roles yet
([codex#36855](https://github.com/openai/codex/issues/36855)). Use the
`arcade:try-arcade` skill instead.

**Lifecycle hooks don't run on Codex yet.** Codex ignores plugin hooks for
Agent Plugins packages ([openai/codex#39895](https://github.com/openai/codex/issues/39895)).
Removing the root `$schema` would work around it but break Agent Plugins
conformance, so use `@Arcade` or `$arcade:try-arcade` for routing until that
issue is fixed.

## Install

```bash
codex plugin marketplace add ArcadeAI/arcade-plugin
codex plugin add arcade@arcade
```

This uses Codex's own marketplace support and the repo's marketplace manifest.

**Cross-client CLI.** `npx plugins add` alone caches the plugin and enables it
in `config.toml`, but `codex plugin list` shows it as not installed and no MCP
server loads until you finish with `codex plugin add`:

```bash
npx plugins add ArcadeAI/arcade-plugin --target codex
codex plugin add arcade@plugins-cli
```

From a local checkout:

```bash
npx plugins add /path/to/arcade-plugin --target codex
codex plugin add arcade@plugins-cli
```

## Verify

1. **Start a new Codex session** (or a new chat in ChatGPT desktop). Installs
   are not retroactive to open sessions.
2. Run **`/plugins`** and confirm `arcade` is installed and enabled (Space
   toggles enablement).
3. Confirm the **`arcade`** MCP server is connected.
4. Skills appear as **`arcade:try-arcade`** and **`arcade:scale-arcade`**. Codex
   does not expose plugin skills as `/slash` commands. Pick **`@Arcade`** from the `@` menu plus a
   plain-language ask, or **`$arcade:try-arcade`** / **`$arcade:scale-arcade`**
   for explicit skill invocation.

Listing metadata such as the **Arcade** display name lives in
`extensions.com.openai.interface` on the portable `plugin.json`.

## First steps

- `@Arcade` — "How do I use Arcade?"
- `$arcade:try-arcade` — explicit skill invocation
- "What's on my calendar tomorrow?"
