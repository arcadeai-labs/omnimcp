import type { Plugin } from "@opencode-ai/plugin"

// Arcade (OmniMCP) for OpenCode.
//
// Installing this plugin does two things:
//   1. Registers the `arcade` remote MCP server (https://omni.arcade.dev/mcp)
//      via the `config` hook, so the 500+ Arcade tools (Slack, Gmail, GitHub,
//      Calendar, Notion, Linear, and more) are available — no keys, OAuth is
//      auto-discovered. (You can also configure this manually in opencode.json;
//      see clients/opencode/opencode.json.)
//   2. Surfaces the one-time app sign-in link as a toast when an Arcade tool
//      returns one, so it isn't buried in a tool result.
//
// Install with `opencode plugin opencode-arcade`, add "opencode-arcade" to the
// `plugin` array in opencode.json, or load locally with a "file://" path.

const ARCADE_MCP_URL = "https://omni.arcade.dev/mcp"

// Fallback pattern, used only when an Arcade result isn't parseable JSON.
const SIGNIN_URL =
  /https?:\/\/[^\s"'<>)]*(?:oauth|authoriz|connect|consent)[^\s"'<>)]*/i

const isArcadeTool = (toolName: unknown): boolean =>
  typeof toolName === "string" && /arcade/i.test(toolName)

// Depth-limited search for an `authorization_url` string field, the structured
// sign-in marker in Arcade tool results (present even when success is true).
const findAuthorizationUrl = (value: unknown, depth = 0): string | null => {
  if (depth > 3 || value === null || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.authorization_url === "string" && record.authorization_url) {
    return record.authorization_url
  }
  for (const child of Object.values(record)) {
    const found = findAuthorizationUrl(child, depth + 1)
    if (found) return found
  }
  return null
}

const extractSignInUrl = (rawOutput: unknown): string | null => {
  const text =
    typeof rawOutput === "string" ? rawOutput : JSON.stringify(rawOutput ?? "")
  try {
    const url = findAuthorizationUrl(JSON.parse(text))
    if (url) return url
  } catch {
    // Not JSON — fall through to the regex heuristic.
  }
  const match = text.match(SIGNIN_URL)
  return match ? match[0] : null
}

export const ArcadePlugin: Plugin = async ({ client }) => {
  return {
    // Register the Arcade MCP server if it isn't already configured.
    config: async (config) => {
      const cfg = config as { mcp?: Record<string, unknown> }
      cfg.mcp = cfg.mcp ?? {}
      if (!cfg.mcp.arcade) {
        cfg.mcp.arcade = {
          type: "remote",
          url: ARCADE_MCP_URL,
          enabled: true,
        }
      }
    },

    // When an Arcade tool returns a sign-in link, surface it as a toast.
    // Scoped to Arcade tool executions so unrelated OAuth-looking URLs from
    // other tools never trigger it.
    "tool.execute.after": async (input, output) => {
      try {
        const call = input as { tool?: unknown }
        if (!isArcadeTool(call?.tool)) return
        const result = output as { output?: unknown }
        const url = extractSignInUrl(result?.output ?? output)
        if (!url) return
        await client.tui.showToast({
          body: {
            message: `Arcade: sign in to connect an app — ${url}`,
            variant: "info",
          },
        })
      } catch {
        // A plugin hook must never break the tool flow.
      }
    },
  }
}
