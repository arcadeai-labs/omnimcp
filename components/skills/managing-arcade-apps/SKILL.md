---
name: managing-arcade-apps
description: List, disconnect, reconnect, and fix the apps Arcade is connected to for the user — Google, GitHub, Slack, Notion, and more — including switching accounts, expired sign-ins, and missing permissions, plus the one-time sign-in when a task needs an app that isn't connected yet. Use when the user asks which apps are connected, wants to disconnect, reconnect, or switch the account for an app, or a tool returns a sign-in link. Not for performing tasks inside apps.
---

# Managing connected apps

`Arcade_Apps` lives on the `arcade` MCP server.

## Quick start

```text
Arcade_Apps(action: "list")                      # all apps + connected state + account
Arcade_Apps(action: "disconnect", app_id: "...") # remove one app (confirm first)
```

Use **apps** language: app, connected, not connected, permissions, sign in,
disconnect. Avoid authorization, OAuth, scopes, provider, token.

## List

Call `Arcade_Apps(action: "list")` and show each app, whether it's connected,
and the account it's connected as. Connected apps first. Don't show internal
ids or raw permission strings.

### Example

```text
Arcade_Apps(action: "list")
  → {apps: [{app_id: "google", name: "Google", connected: true, account: "sam@arcade.dev"},
            {app_id: "slack", name: "Slack", connected: false}, ...]}
Reply:
  Connected: Google (sam@arcade.dev), GitHub (spartee)
  Not connected: Slack, Notion, Dropbox, …
```

## Disconnect

Call `Arcade_Apps(action: "disconnect", app_id: "<id from list>")`. **Confirm
with the user first** — disconnecting removes Arcade's access to that app.
Report the outcome plainly.

## Signing in to an app

The first time a task needs an app the user hasn't connected, a tool returns a
one-time sign-in link. **The response may say `success: true` — an
`authorization_url` in the output still means sign-in required, not a completed
task.**

1. Present the link: "Sign in to connect your **<App>** here, then tell me to
   continue."
2. Stop and wait for the user — never poll or retry in a loop.
3. After they confirm, retry the original request once.

## Fixing an app connection

For wrong account, expired sign-in, missing permissions, or an explicit
"reconnect" request, use `Arcade_ManageToolAuthorization` (same `arcade` MCP
server) with a `tool_name` from the affected app:

```text
Arcade_ManageToolAuthorization(action: "status", tool_name: "...")          # check the connection
Arcade_ManageToolAuthorization(action: "switch_account", tool_name: "...",
                               provider_id: "<from status>")                # sign in as a different account
Arcade_ManageToolAuthorization(action: "reauthorize", tool_name: "...",
                               provider_id: "<from status>")                # expired / missing permissions
```

Each returns a fresh sign-in link — present it, stop, and wait, exactly like a
first-time sign-in. Keep apps language: say "switch the account" or "sign in
again", not reauthorize/OAuth/scopes. If the user was signed in with the wrong
account, remind them the sign-in screen may reuse their browser session — they
may need to switch accounts on the app's own page.

## When not to use

- Performing tasks inside an app (sending, fetching, scheduling) — that's the
  `using-arcade-tools` skill.
- Don't call `list` speculatively before every task; tools surface sign-in
  links on their own when an app is missing.
