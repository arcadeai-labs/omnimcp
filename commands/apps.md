---
description: See your connected apps, or disconnect one (Google, GitHub, Slack, Notion, Microsoft, Linear, …).
---

Help the user manage their connected apps using the `Arcade_Apps` tool.

- **List:** call `Arcade_Apps` with `action: "list"` and present a short, readable
  summary — for each app, its name, whether it's **connected**, and (when
  connected) the account it's connected as. Put connected apps first, then not
  connected. Do not show internal ids, raw permission strings, or tokens.
- **Disconnect:** call `Arcade_Apps` with `action: "disconnect"` and the `app_id`
  from the list. **Confirm with the user before disconnecting** — disconnecting
  removes Arcade's access to that app. Report the outcome plainly afterward.

Use the words "app", "connected", "disconnect", and "permissions" — not
authorization/OAuth/scopes/providers.

Request:

$ARGUMENTS
