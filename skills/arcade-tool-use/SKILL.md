---
name: arcade-tool-use
description: How to get things done with external services via Arcade Omni — Slack, Gmail, GitHub, Google Calendar, Notion, Linear, Drive, and 500+ more. Use when the user asks to send, post, fetch, search, schedule, create, or update anything in a third-party app.
---

# Using Omni

Omni connects you to Arcade's full external-tool catalog. You discover tools at
runtime and execute them — there is no static list to memorize. Treat discovery
like syntax highlighting: invisible plumbing the user shouldn't have to think
about.

## Prefer delegating

When a task needs an external service, prefer handing it to a subagent so the
discovery noise stays out of the main conversation:

- General tasks → `arcade-operator`
- Email → `inbox-agent`
- Calendar / scheduling → `schedule-agent`

## If you call the tools directly

1. `Arcade_SelectTools(tasks=[...])` — one `tasks` entry per logical workflow.
   Returns candidates with their `input_schema` inline.
2. `Arcade_UseTool(tool_name, inputs, query_id)` — execute. Use `tool_name`
   exactly as returned: `Toolkit_Action` form, **no** `@version` suffix, **no**
   period. Pass the originating `query_id`.
3. `Arcade_Apps` — to see or disconnect the user's connected apps (see the
   `arcade-apps` skill).

## Behavior

- Don't narrate discovery ("let me search for a tool…"). Deliver the outcome.
- Don't dump schemas or present a list of tools for the user to pick from.
- A tool that needs an app the user hasn't connected returns a one-time sign-in
  link — present it, then retry once they confirm. Never loop.
- Prompt only when a genuinely required input is missing (which channel, which
  repo, which recipient).
