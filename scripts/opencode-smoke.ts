// OpenCode plugin smoke test. Run with: bun scripts/opencode-smoke.ts
// No dependencies: `import type` in index.ts is erased at runtime, so the
// plugin module loads without node_modules.

import { ArcadePlugin } from "../clients/opencode/index.ts"

const failures: string[] = []
const assert = (condition: unknown, message: string): void => {
  if (!condition) failures.push(message)
}

const toasts: string[] = []
const client = {
  tui: {
    showToast: async ({ body }: { body: { message: string } }) => {
      toasts.push(body.message)
    },
  },
}

const hooks = await ArcadePlugin({ client } as never)
assert(typeof hooks.config === "function", "plugin must expose a config hook")
assert(typeof hooks["tool.execute.after"] === "function", "plugin must expose tool.execute.after")

// config: registers the arcade server on an empty config
const emptyConfig: { mcp?: Record<string, { url?: string }> } = {}
await hooks.config!(emptyConfig as never)
assert(
  emptyConfig.mcp?.arcade?.url === "https://omni.arcade.dev/mcp",
  "config hook must register the arcade MCP server",
)

// config: never overwrites an existing user entry
const userConfig = { mcp: { arcade: { url: "https://example.com/custom" } } }
await hooks.config!(userConfig as never)
assert(
  userConfig.mcp.arcade.url === "https://example.com/custom",
  "config hook must not overwrite an existing arcade entry",
)

const after = hooks["tool.execute.after"]!

// toast: structured authorization_url from an Arcade tool, even with success: true
await after(
  { tool: "arcade_Arcade_UseTool" } as never,
  {
    output: JSON.stringify({
      success: true,
      output: { authorization_url: "https://accounts.google.com/o/oauth2/auth?state=x" },
    }),
  } as never,
)
assert(toasts.length === 1, "structured authorization_url from an Arcade tool must toast")

// no toast: OAuth-looking URL from a non-Arcade tool
await after(
  { tool: "webfetch" } as never,
  { output: "see https://evil.example/oauth/authorize?state=y" } as never,
)
assert(toasts.length === 1, "non-Arcade tool output must never toast")

// no toast: Arcade tool result without any sign-in link
await after(
  { tool: "arcade_Arcade_UseTool" } as never,
  { output: JSON.stringify({ success: true, output: { ok: true } }) } as never,
)
assert(toasts.length === 1, "Arcade result without a sign-in link must not toast")

// toast: regex fallback for non-JSON Arcade output
await after(
  { tool: "arcade_Arcade_UseTool" } as never,
  { output: "Sign in at https://slack.com/oauth/authorize?state=z to continue" } as never,
)
assert(toasts.length === 2, "regex fallback must still catch sign-in links in plain-text Arcade output")

if (failures.length > 0) {
  console.error(`opencode-smoke: ${failures.length} failure(s)`)
  for (const message of failures) console.error(`  ✗ ${message}`)
  process.exit(1)
}
console.log("opencode-smoke: all assertions passed")
