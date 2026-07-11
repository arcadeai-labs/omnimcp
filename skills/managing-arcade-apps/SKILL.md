---
name: managing-arcade-apps
description: List, disconnect, and check the apps Arcade is connected to for the user — Google, GitHub, Slack, Notion, and more — and handle the one-time sign-in when a task needs an app that isn't connected yet. Use when the user asks which apps are connected, wants to disconnect or reconnect an app, or a tool returns a sign-in link. Not for performing tasks inside apps.
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
one-time sign-in link:

1. Present the link: "Sign in to connect your **<App>** here, then tell me to
   continue."
2. Stop and wait for the user — never poll or retry in a loop.
3. After they confirm, retry the original request once.

## When not to use

- Performing tasks inside an app (sending, fetching, scheduling) — that's the
  `using-arcade-tools` skill.
- Don't call `list` speculatively before every task; tools surface sign-in
  links on their own when an app is missing.
