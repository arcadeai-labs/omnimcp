---
name: arcade-connect
description: Connect an app to Arcade (Google, GitHub, Slack, Notion, …) with a one-time sign-in.
---

Help the user connect the app they name through the **`arcade` MCP server
only** (plugin gateway).

1. Discover whether the app is already connected. If it is, say so (with
   the account) and stop.
2. Start sign-in for that app. Present the link: "Sign in to connect your
   **app** here, then tell me to continue."
3. Stop and wait — do not poll or retry in a loop.
4. After they confirm, retry once and report the connected account.

If the gateway has no tool for that app, say it may not be supported yet.

App to connect:

$ARGUMENTS
