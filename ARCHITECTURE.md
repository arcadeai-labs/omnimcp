# Architecture

A portable Agent Plugin (`plugin.json`, `mcp.json`, `skills/`) plus the files
each client needs at its own path. Every client-specific file is generated
from a few sources and checked in. Development packages, scripts, and tests
stay out of this tree, so installing the plugin does not install them. The
package ships no credentials.

| Source (edit these) | Holds |
| --- | --- |
| `plugin.json`, `mcp.json`, `VERSION` | identity, gateway URL, version, Codex listing metadata |
| `hooks/routing-guidance.mjs` | the routing rules, as sentences |
| `hooks/hook-hosts.mjs` | which hook script runs on which event in which client |
| `hooks/telemetry-contract.mjs` | the telemetry event contract; also generates the event tables in docs/telemetry.md |
| `agents/arcade-operator.agent.md` | the operator, outside its generated rules block |
| `skills/` | the skills, outside the generated rules block in try-arcade |

`.gitattributes` lists every generated file (GitHub collapses them in diffs).

- The operator lives at `agents/arcade-operator.agent.md`, the only place both
  Claude Code and Cowork accept. Copilot CLI and VS Code only read
  `com.github.copilot/agents/`, so the generator copies it there.
- Each hook command passes `--host <name>`; the script prints the output
  format that client reads.
- Codex doesn't run plugin hooks for Agent Plugins packages yet; see
  [docs/install/codex.md](docs/install/codex.md).

Release Please bumps `VERSION`, `plugin.json`, and the version fields in the
generated manifests.

## Execution model

Skills should activate from the outcome the person asks for; they must not
require a `/do`-style command. Hosts that expose skills still let the user
invoke `/try-arcade` or `/scale-arcade` by name. When a compatible host can
delegate to `arcade-operator`, the parent agent keeps the user-facing
reasoning and hands tool discovery and execution to the operator. Otherwise
it follows the same Arcade discovery and execution loop itself.

```text
  user
   ├── describes an outcome
   └── or invokes /try-arcade · /scale-arcade
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  parent agent                                                │
│  user conversation · clarification · sign-in · confirmation  │
│                                                              │
│   external service tasks ──────► try-arcade                  │
│   team or org rollout ──────────► scale-arcade                │
│   other Arcade product/docs ───► docs.arcade.dev/llms.txt    │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
                │ host has arcade-operator     │ no operator
                ▼                              ▼
        ┌───────────────┐              same loop
        │ arcade-       │              runs in parent
        │ operator      │
        └───────┬───────┘
                │
                ▼
        Arcade_SelectTools  ──►  Arcade_UseTool  ──►  result tool
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│  mcp.json  →  Streamable HTTP Gateway                        │
│  https://api.arcade.dev/mcp/arcade                           │
│                                                              │
│  only external capability boundary                           │
│  canonical telemetry lives here, not in the plugin           │
└──────────────────────────────────────────────────────────────┘
                │
                ▼
        connected apps (email, calendar, issues, chat, …)

  operator returns one of:
    completed | needs_auth | needs_confirmation | needs_clarification | failed
```

The parent remains responsible for user-facing clarification, sign-in, and
confirmation. The operator returns one bounded outcome instead of inventing
success or narrating tool internals.

## Observability boundary

The Arcade MCP server is the canonical place to record request, authentication,
tool-discovery, tool-call, and completion outcomes. This package does not ask a
model to self-report tokens, turns, or success.

Optional client hooks in `hooks/telemetry-adapters/` can send supplemental,
scoped usage events when `TELEMETRY_ENABLED` is `true` and the user has not
opted out. **This build keeps `TELEMETRY_ENABLED` false**, so no telemetry
hooks are generated and nothing is sent. See [docs/telemetry.md](docs/telemetry.md)
for the contract, opt-outs, local state, and the separate approval required
before collection can be enabled. Gateway telemetry remains authoritative;
plugin events do not establish task success.
