---
name: arcade-status
description: Check your Arcade connection — server, sign-in, and connected apps.
---

Run a short health check. Stop at the first failure with a one-line fix.

1. **Server** — Are Arcade tools listed on the `arcade` MCP server? If not:
   "The Arcade server isn't connected — check Settings → MCP (Cursor) or
   run /mcp (Claude Code) and sign in to **arcade**."
2. **Sign-in + apps** — On the **`arcade` MCP server only**, discover and run
   the apps list tool.
   - An authentication error → "You're not signed in — open the arcade
     server's sign-in prompt in your client settings."
   - Success → how many apps are connected vs available (names for
     connected ones only).

Present a compact status block — short lines, no raw JSON, no internal ids.
If everything is healthy, end with one example of what they can ask for.

$ARGUMENTS
