---
name: managing-arcade-apps
description: See and disconnect the apps Arcade can act on for the user, and handle the one-time sign-in that appears the first time a task needs an app. Use when the user asks what apps are connected, asks to disconnect or remove an app, or when a task needs an app they have not connected yet.
---

# Managing connected apps

## Quick start

```text
Arcade_Apps(action: "list")                      # all apps + connected state + account
Arcade_Apps(action: "disconnect", app_id: "...") # remove one app (confirm first)
```

Use **apps** language: app, connected, not connected, permissions, sign in,
disconnect. Avoid authorization, OAuth, scopes, provider, token.

## List

Call `Arcade_Apps(action: "list")` and show each app, whether it's connected, and
the account it's connected as. Connected apps first, then not connected. Don't
show internal ids or raw permission strings.

## Disconnect

Call `Arcade_Apps(action: "disconnect", app_id: "<id from list>")`. **Confirm with
the user first** — disconnecting removes Arcade's access to that app. Report the
outcome plainly.

## Signing in to an app

The first time a task needs an app the user hasn't connected, a tool returns a
one-time sign-in link:

1. Present the link: "Sign in to connect your **<App>** app here, then tell me to
   continue."
2. Wait for the user to confirm — do not poll or retry in a loop.
3. After they confirm, retry the original request.
