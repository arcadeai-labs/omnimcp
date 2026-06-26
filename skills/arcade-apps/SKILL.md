---
name: arcade-apps
description: Manage the user's connected apps in Arcade — see which apps are connected and the account each is connected as, and disconnect an app. Also covers the one-time sign-in that appears the first time a task needs an app. Use when the user asks what apps are connected, asks to disconnect an app, or when a task needs an app they haven't connected yet.
---

# Apps

Arcade acts on the user's behalf in their apps — Google, GitHub, Slack, Notion,
Microsoft, Linear, and more. Use **apps** language throughout: app, connected,
not connected, permissions, sign in, disconnect. Avoid authorization, OAuth,
scopes, provider, and token.

## See or disconnect apps

Use the `Arcade_Apps` tool (or the `/arcade:apps` command):

- **List:** `Arcade_Apps(action: "list")` — show each app, whether it's connected,
  and the account when connected. Put connected apps first, then not connected.
  Don't show internal ids or raw permission strings.
- **Disconnect:** `Arcade_Apps(action: "disconnect", app_id: "<id from list>")`.
  **Confirm with the user first** — disconnecting removes Arcade's access to that
  app. Report the outcome plainly.

## Signing in to an app

The first time a task needs an app the user hasn't connected, a tool returns a
one-time sign-in link:

1. Present the link: "Sign in to connect your **<App>** app here, then tell me to
   continue."
2. Wait for the user to confirm — do not poll or retry in a loop.
3. After they confirm, retry the original request.
