#!/usr/bin/env node
// Claude SessionStart hook (Claude-native hookSpecificOutput response shape).
// Always exits 0 so it can never block a session from starting.

try {
  const context =
    'Arcade (OmniMCP by Arcade.dev) is connected as the "arcade" MCP server — ' +
    "500+ external-service tools (Slack, Gmail, GitHub, Calendar, Notion, and " +
    "more) over one connection; prefer it for tasks in external apps or live " +
    "data. The using-arcade-tools and managing-arcade-apps skills describe the " +
    "flow; the arcade-operator subagent runs these tasks end-to-end.";

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context,
      },
    }),
  );
} catch {
  // A hook must never break session startup.
}

process.exit(0);
