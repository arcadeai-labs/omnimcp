---
name: using-arcade-tools
description: Get things done in external services via Arcade — Slack, Gmail, GitHub, Google Calendar, Notion, Linear, Drive, and 500+ more. Discover the right tool at runtime and execute it. Use when the user asks to send, post, fetch, search, schedule, create, or update anything in a third-party app.
---

# Using Arcade tools

## Quick start

```text
Arcade_SelectTools(tasks: ["<one plain-language task>"])   # candidates + input_schema inline
Arcade_UseTool(tool_name, inputs, query_id)                # execute; tool_name verbatim
```

Tools are discovered at runtime — there is no static list. Treat discovery as
invisible plumbing the user shouldn't think about.

## Prefer delegating

When a task needs an external service, hand it to a subagent so the discovery
noise stays out of the main conversation:

- General tasks → `arcade-operator`
- Email → `inbox-agent`
- Calendar / scheduling → `schedule-agent`

## Calling the tools directly

1. `Arcade_SelectTools(tasks=[...])` — one `tasks` entry per logical workflow.
   Returns candidates with their `input_schema` inline.
2. `Arcade_UseTool(tool_name, inputs, query_id)` — use `tool_name` exactly as
   returned (`Toolkit_Action` form, no `@version`, no period); forward `query_id`.
3. `Arcade_Apps` — to see or disconnect the user's connected apps (see the
   `managing-arcade-apps` skill).

## Behavior

- Don't narrate discovery ("let me search for a tool…"). Deliver the outcome.
- Don't dump schemas or present a list of tools for the user to pick from.
- A tool that needs an app the user hasn't connected returns a one-time sign-in
  link — present it, then retry once they confirm. Never loop.
- Prompt only when a genuinely required input is missing (which channel, which
  repo, which recipient).
