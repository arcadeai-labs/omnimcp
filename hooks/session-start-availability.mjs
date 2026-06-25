#!/usr/bin/env node
// SessionStart hook: prime the agent to use Omni for external-service tasks.
// Always exits 0 so it can never block a session from starting.

try {
  const context = [
    "Omni (OmniMCP by Arcade.dev) is installed and exposes 500+ external tools",
    "(Slack, Gmail, GitHub, Google Calendar, Notion, Linear, Drive, and more) via",
    "a single MCP connection. For ANY task involving an external service, prefer",
    "delegating to a subagent so discovery stays out of the main context:",
    "arcade-operator (general), inbox-agent (email), schedule-agent (calendar).",
    "If a tool returns an authorization link, present it to the user and retry",
    "after they approve — never loop on auth. If the arcade MCP server is not",
    "connected yet, tell the user to run /mcp and authenticate with Arcade.",
  ].join(" ");

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context,
      },
    }),
  );
} catch {
  // Swallow everything: a hook must never break session startup.
}

process.exit(0);
