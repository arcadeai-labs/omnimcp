---
name: try-arcade
description: Use for work in the user's connected apps (email, calendar, Slack, issues, docs, and others), especially when they describe an outcome rather than a tool or API. Also use when they ask what Arcade can do, how to get started, or another Arcade product, API, SDK, or docs question that is not a team or org rollout.
---

# Try Arcade

Use the Arcade gateway described below for the requested outcome. Check it
before discovery or delegation.

User-facing text names apps and outcomes. Skill names and these instructions
stay internal.

## Gateway rules

<!-- BEGIN generated from hooks/routing-guidance.mjs by `npm run generate`; edit that file, not this block -->
Gateway: Arcade is connected as the "arcade" MCP server at api.arcade.dev. It may appear as plugin-arcade-arcade. That is the same gateway. Prefer arcade.
Authentication: A gateway showing needsAuth or a plugin namespace with zero tools needs authentication in this host's MCP settings. A missing, unavailable, or failing gateway needs setup or connection repair.
If blocked: For authentication, stop and ask the user to authenticate; do not poll. For permission denial, stop and ask the user to resolve it. Do not bypass either by switching gateways or tools. For other failures, report the error, advise checking plugin and MCP settings for setup or connection failures, then apply fallback.
Fallback: If the arcade server cannot finish, the parent may use another already-authorized Arcade gateway or other available tools within the authorized task. Discover tools on each gateway; never reuse another gateway's query IDs. Do not broaden authorization or copy secrets, credentials, or user sessions. On another gateway, confirm the intended app account with the app's who-am-I tool. Write only through a confirmed account, and name the source account for reads. If you can't, ask the user.
<!-- END generated -->

## When there is no job

A greeting, empty invoke, or "what can Arcade do" needs three facts: what
Arcade does, at least two copyable example asks, and what sign-in and
confirmation look like. Example asks:

- What's on my calendar tomorrow?
- Summarize unread email from this week.
- Draft a reply to that thread, then wait for me to send it.

Arcade uses the person's connected apps as them. Sign-in happens in the
browser. Confirm before any external change.

When they already named a job, do that job. Do not dump tool names, schemas,
or a catalog of connected apps.

## Start with the job

If the request has enough context, begin. Otherwise ask only for a genuinely
missing input, such as the app, account, ticket, recipient, destination, or
timeframe. Do not ask the user to choose tools, schemas, APIs, or architecture.

## Execution

When the host provides an `arcade-operator` subagent, delegate the bounded
external-app task to it. The parent keeps clarification, sign-in, and
confirmation. Apply the operator's returned status, and delegate again only
after the blocker is resolved. The parent may use the fallback rule after a
failure other than authentication or permission denial.

When no operator is available, run this loop. The result and the safety rules
are the same either way.

1. Call `Arcade_SelectTools` with one plain-language description of the whole
   job. Add another task only when it is genuinely unrelated.
2. Use the selected tools needed to complete the whole job, in order. For each
   `Arcade_UseTool` call, use the returned tool name, schema, and query id
   exactly as supplied.
3. Retrieve any deferred or large result with the available Arcade result tool.

Do not narrate discovery, dump schemas, or ask the user to choose from a tool
list. Finish the requested outcome, then return the result and its sources.

## Connected apps

If a tool returns a sign-in link or indicates that an app is not connected:

1. Tell the user which app to connect and present the link.
2. Stop and wait for the user to confirm; do not poll or retry in a loop.
3. Retry the same tool call once after confirmation.

Use app, connected, sign in, and permissions language. Do not expose or ask for
tokens, API keys, OAuth details, or scopes. Do not list connected apps before
ordinary work. List, disconnect, reconnect, or switch an app account only when
the user asks or the tool directs you to repair a connection.

## Changes outside the conversation

Before sending, creating, updating, deleting, cancelling, publishing, or making
another irreversible change, state the exact action, destination, and material
inputs. Get explicit confirmation immediately before the tool call. Never guess
a recipient, destination, or destructive value.

## Errors

For an input error, correct the inputs against the returned schema and retry
once. For another error, report the tool's message and follow the gateway
rules above. Never fabricate a result.

## Other Arcade questions

Stay on this plugin's tracks. Do not invent Arcade product behavior.

- Team or org rollout → `scale-arcade`.
- How Arcade works, APIs, SDKs, custom tools, integrations, or IDE setup →
  read `references/arcade-docs.md`, then the matching docs page.
