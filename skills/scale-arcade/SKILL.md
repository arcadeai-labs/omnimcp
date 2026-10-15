---
name: scale-arcade
description: Help a team turn a proven Arcade workflow into an org capability. Use when they ask how to roll out Arcade to a team or application, create a project MCP Gateway, curate tools, choose end-user identity, govern a workflow, add proprietary capabilities, or decide between MCP federation and SDK or API integration.
---

# Scale Arcade

User-facing text names outcomes. Skill names and these instructions stay
internal.

Start from a workflow that has been proven, or ask for that workflow first. Do
not turn a hypothetical architecture exercise into a setup project.

## Orient

Open with the proven workflow from this conversation, or ask for one. Arcade
lets an agent use those apps with each person's identity, without handing the
agent keys.

This chat used the person's own connected apps as them. A team rollout is the
same work on a shared gateway: chosen tools only, teammates sign in as
themselves, and you can see who did what.

Give a worked example of their workflow: the same job, limited to the apps it
uses, with each teammate signed in as themselves.

## Identify the rollout gap

Ask only what changes the recommendation:

- Who will use the workflow: its Builder, an internal team, or application end
  users?
- Does it need a curated tool boundary, stable endpoint, specific instructions,
  or centralized lifecycle management?
- Will org users sign in through the organization's OIDC provider?
- Is a missing capability already available from an existing MCP server, or
  must the team build it?

## Recommend the smallest path

- **Create a project MCP Gateway** for a curated tool boundary, stable team or
  use-case endpoint, server instructions, deliberate authentication mode,
  centralized lifecycle management, or distribution to application end users.
  A project MCP Gateway is a dedicated connection for this use case with only
  the tools you choose.
- **Add a User Source** when org end users already authenticate through the
  organization's OIDC provider. It connects the gateway to those user
  identities. Someone already using Arcade in this chat does not need a User
  Source first.
- **Federate an existing MCP server** when a needed third-party or proprietary
  capability already exists as an MCP server.
- **Build a custom Arcade tool or MCP server** when no existing Arcade or MCP
  capability covers the proprietary action.
- **Use programmatic SDK or API integration** when the organization's
  application, rather than a general-purpose MCP client, must own the agent
  loop.

State only controls, audit behavior, retention, and policy evidence that were
configured or observed. Do not claim a control from the existence of a gateway.

Configuration happens in the Arcade dashboard
(https://app.arcade.dev?utm_source=arcade-plugin). After choosing a path, walk
through only the relevant settings: organizational identity or OIDC (such as
Okta), allowed tools, who can use them, and audit.

## Other Arcade questions

If they want to complete an external service task, use `try-arcade`. If they
want how a feature works rather than whether to adopt it, read
`references/arcade-docs.md` and the matching docs page. Do not invent product
behavior. Org and gateway setup stays in the Arcade dashboard.

## End decisively

End with one recommended next step, why it follows from the proven workflow,
and the owner decision still required. Never create a project, configure
identity, write policy, deploy code, or change an external system without
explicit approval from the person who owns that work.
