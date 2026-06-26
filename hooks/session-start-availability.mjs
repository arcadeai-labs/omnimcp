#!/usr/bin/env node
// SessionStart hook: prime the agent to use Omni for external-service tasks.
// Always exits 0 so it can never block a session from starting.

try {
  // Declarative environment facts (not imperative instructions): stating what is
  // available reads as project context. Behavior lives in the skills/subagents.
  const context = [
    "Arcade (OmniMCP by Arcade.dev) is connected as the \"arcade\" MCP server and",
    "exposes 500+ external-service tools (Slack, Gmail, GitHub, Google Calendar,",
    "Notion, Linear, Drive, and more) over one connection. Three subagents cover",
    "these tasks: arcade-operator (general), inbox-agent (email), schedule-agent",
    "(calendar). Connected-app management is available via the /arcade:apps",
    "command. The using-arcade-tools and managing-arcade-apps skills describe the",
    "tool-discovery and app sign-in flow.",
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
