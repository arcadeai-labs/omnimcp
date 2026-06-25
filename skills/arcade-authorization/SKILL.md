---
name: arcade-authorization
description: Handle Arcade Omni authorization — connecting a provider for the first time, reconnecting, switching accounts (e.g. a different Gmail or GitHub login), or fixing missing OAuth scopes. Use when a tool returns an authorization link or the user asks to reconnect, re-authorize, or switch accounts.
---

# Omni authorization

Omni runs tools on the user's behalf against services like Google, GitHub, and
Slack. Those require OAuth.

## First-time / expired access

When `Arcade_UseTool` returns an authorization URL:

1. Present the link to the user with a one-line instruction: "Approve access
   here, then tell me to continue."
2. Wait for the user to confirm. Do **not** poll or retry in a loop.
3. After they confirm, retry the same `Arcade_UseTool` call.

## Reconnect / switch account / fix scopes

When the user explicitly wants to reconnect, use a different account, or repair
permissions, call `Arcade_ManageToolAuthorization`. It can inspect the current
authorization, remove a stale provider connection, and start a fresh flow.

Typical phrasings that map here:
- "Use my other GitHub account."
- "Reconnect Slack."
- "It says I don't have permission to send mail — fix the scopes."

Present any resulting authorization link the same way: show it, wait, then
retry. Never retry auth automatically in a loop.
