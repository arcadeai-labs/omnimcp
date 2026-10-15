---
name: arcade-apps
description: See your connected apps, or disconnect one (Google, GitHub, Slack, Notion, Microsoft, Linear, …).
---

Help the user manage connected apps through the **`arcade` MCP server only**
(plugin gateway). Use app, connected, sign in, and permissions. Leave out
tokens, OAuth, and scopes.

- **List:** ask Arcade to list connected apps, then summarize each app's
  name, whether it is connected, and the account when connected. Connected
  apps first. Do not show internal ids, raw permission strings, or tokens.
- **Disconnect:** confirm first. Disconnecting removes Arcade's access to
  that app. Then run the disconnect action the tool schema describes.
- **Fix a connection** (wrong account, expired sign-in, reconnect): present
  the sign-in link the tool returns, stop, and wait. Retry once after the
  user confirms.

Request:

$ARGUMENTS
