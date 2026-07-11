# Release QA checklist

Automated checks (`node scripts/check.mjs`, `bun scripts/opencode-smoke.ts`,
`npm pack --dry-run`) run in CI. Everything below tests model or client
behavior and is verified by hand before tagging a release.

## Local loads

- [ ] **Claude Code:** `claude plugin validate .` passes, then load with
  `claude --plugin-dir .` — verify 2 skills, 1 agent (`arcade-operator`),
  3 commands (`/arcade:do`, `/arcade:apps`, `/arcade:tools`), the SessionStart
  hook context, and the `arcade` MCP server connect.
- [ ] **Cursor:** copy/symlink the repo to `~/.cursor/plugins/local/arcade`,
  reload, and in Customize verify exactly: 1 rule, 2 skills, 1 agent,
  3 commands, 1 hook, 1 MCP server — and nothing else. Start a new chat and
  confirm the sessionStart context appears (Hooks output channel shows no
  errors).
- [ ] **OpenCode:** `opencode plugin opencode-arcade` (or `file://` path),
  restart, confirm the `arcade` server is registered and tools list.

## Auth-flow scenarios (any client)

- [ ] **First sign-in:** task against an unconnected app → sign-in link is
  presented once; agent stops and waits (no retry loop).
- [ ] **Sign-in marked successful:** confirm the agent treats an
  `authorization_url` response as sign-in required even though the result says
  `success: true` — it must not report the task as done.
- [ ] **Completed sign-in:** after confirming, the agent retries once and
  delivers the result.
- [ ] **Pending sign-in:** asking again before signing in re-presents the link
  without spamming new authorizations.
- [ ] **Wrong account:** "switch the account for <app>" →
  `switch_account` flow returns a fresh link; agent reminds about browser
  session reuse.
- [ ] **Expired / missing permissions:** `reauthorize` flow returns a fresh
  link.
- [ ] **Disconnect:** `/arcade:apps` disconnect asks for confirmation first,
  then reports the outcome.
- [ ] **Outbound confirmation:** "email X to Y" prompts for confirmation of
  recipient/content before sending.
- [ ] **Non-auth failure:** a tool error is reported verbatim; at most one
  retry; no fabricated results.

## Release steps

- [ ] All CI checks green on `main`.
- [ ] `git tag v<version>` + GitHub release with CHANGELOG notes.
- [ ] `npm publish` from `clients/opencode/` (version matches manifests).
- [ ] Cursor Marketplace: submit/refresh at cursor.com/marketplace/publish.
- [ ] Claude: verify `/plugin marketplace update arcade` picks up the new
  version from a machine with the old version installed.
- [ ] README upgrade note accurate for users on older cached versions.
