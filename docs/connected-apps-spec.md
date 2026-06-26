# Apps Rename + Minimal Apps Management — Spec

Status: Draft / proposal
Owner: Arcade (Omni + plugin)
Scope: Minimal changes only (rename to apps + list/disconnect)

## 1. Goal

Keep this simple:
- End users should interact with **apps** language.
- Provide two operations only: **list apps** and **disconnect app**.
- Avoid extra architecture (no static catalog files, no runtime normalization or translation layers).

## 2. Explicit scope

### In scope

1. Command rename and UX copy:
   - command set is exactly: `do`, `apps`, `tools`
   - `apps` replaces `auth`
2. Omni MCP surface:
   - add `Arcade_Apps(action, app_id?)`
   - actions: `list`, `disconnect`
3. PostHog tracking for the new apps flow.

### Out of scope

- `connect`
- `switch_account`
- Runtime aliasing/normalization (`Google` vs `google` vs `omni-google`)
- Runtime text translation middleware
- New config/static data files for app mapping

## 3. User-facing language

Use:
- app, connected, not connected, permissions, disconnect

Avoid in user-visible responses:
- authorization, oauth, scope, provider, token, connection

This is done via command/agent/skill prompt text only.

## 4. Omni changes

## 4.1 New MCP tool

```
Arcade_Apps(action, app_id?)
```

| action | args | return |
|---|---|---|
| `list` | none | `{ "apps": [App, ...] }` |
| `disconnect` | `app_id` required | `{ "app_id": "...", "disconnected": true, "connections_deleted": N, "was_connected_before": bool }` |

### App object (list output — app-shaped, no raw plumbing)

```jsonc
{
  "app_id": "google",           // provider_id with the omni- prefix stripped
  "name": "Google",             // ProviderDescription, else title-cased app_id
  "connected": true,
  "account": "sam@arcade.dev",  // from provider_user_info, or null
  "permissions": ["..."]        // granted scope strings, framed as "permissions" in copy
}
```

The tool shapes its own output (in-tool, not a separate translation layer). Raw
`provider_id`/scope plumbing stays internal.

## 4.2 App universe (allowlist-derived)

`list` shows connected AND not-connected apps. The candidate universe is derived
dynamically — no hardcoded map:

- Enumerate allowlisted tools via `engine.ListTools`, filter with `ToolAllowlist`,
  read each tool's `requirements.authorization.provider_id`, dedupe. Build/cache
  at startup (refreshed), never per request.
- Per request, fetch `ListUserConnections(userID, "")` for connected state.
- The list = (universe ∪ connected providers), each marked connected / not connected.

## 4.3 Engine API mapping (already available)

- `list`: `GET /v1/tools` (universe, cached) + `GET /v1/admin/user_connections?user_id=<verified-user>` (connected state)
- `disconnect`: list by provider then `DELETE /v1/admin/user_connections/{id}` for each matching connection

Existing Omni client methods already support this:
- `ListTools(identity, opts)`
- `ListUserConnections(userID, providerID)`
- `DeleteUserConnection(connectionID)`

## 4.4 App id handling (no normalization, no hardcoding)

- `app_id` = `provider_id` with the `omni-` prefix stripped (presentation only);
  always resolve back to the real `provider_id` internally.
- `disconnect` resolves `app_id` against (universe ∪ connected) for the verified user.
- **Idempotent:** a valid app with no live connections returns success with
  `connections_deleted: 0, was_connected_before: false`.
- `app_id_not_found` (with no side effects) is returned only when `app_id` is
  neither connected nor in the universe; the message tells the caller to run
  `Arcade_Apps(list)` first.

## 4.5 Security

- Always use the verified identity user id for list/disconnect; never a
  caller-supplied id.
- **Reject an empty/missing verified user id** before any admin list/delete call.

## 5. Plugin changes (`arcade`)

## 5.1 Commands

Final command set:
- `do`
- `apps` (new canonical)
- `tools`

Migration:
- the `auth` command is **removed outright (no alias)**. Its old reconnect/scope-repair
  behavior is gone; on-demand sign-in still surfaces inline during normal tasks.

## 5.2 `/arcade:apps` behavior

- `/arcade:apps` -> list apps
- `/arcade:apps disconnect <app_id>` -> disconnect app

No connect/switch actions in this command.

## 5.3 Copy updates and removals

- Update static prompt text in command/agent/skill files to apps language. No runtime translation layer.
- **Remove** the `auth` command file entirely.
- **Remove** the PostToolUse auth-surfacing hook (`hooks/post-tool-surface-auth.mjs` and its
  `hooks.json` block); its `mcp__arcade__Arcade_UseTool` matcher never fires under plugin
  namespacing. The `SessionStart` hook stays.
- Rename the `arcade-authorization` skill to `arcade-apps`.

## 6. PostHog tracking (required)

Current events:
- `omni_select_tools`
- `omni_use_tool`
- `omni_manage_auth`

Add:
- `omni_apps_list`
- `omni_apps_disconnect`

### Required properties

Common:
- `action` (`list` or `disconnect`)
- `result_type` (`success` or `error`)
- `duration_ms`
- `error_code`
- `error_class` (`validation`, `engine_http`, `internal`)
- `engine_status_code`
- `service` (`omni`)
- `environment`
- `tenant`
- `customer`

List-specific:
- `apps_total`
- `apps_connected`
- `apps_not_connected`
- `connections_total`

Disconnect-specific:
- `app_id`
- `connections_before`
- `connections_deleted`
- `connections_after`
- `was_connected_before`

### Tracking guardrails

- Do not log auth URLs.
- Do not log token values.
- Do not log raw account identifiers in event properties.

## 7. Rollout

1. Add `Arcade_Apps(list|disconnect)` in Omni (PR A).
2. Replace the `auth` command with `apps`, remove the PostToolUse hook, rename the skill (PR B).
3. Add PostHog events.

PR B must not be released until `Arcade_Apps` is live in **prod** Omni (plugin users hit prod).

## 8. Acceptance criteria

1. "What apps do I have enabled?" uses one `Arcade_Apps(list)` call.
2. No probing loop over `ManageToolAuthorization(status)` for apps list.
3. `/arcade:apps disconnect <app_id>` removes all matching connections.
4. Disconnecting an already-not-connected (but valid) app succeeds idempotently (`connections_deleted: 0`).
5. Unknown `app_id` (not connected and not in the universe) returns `app_id_not_found` with no side effects.
6. PostHog includes full `omni_apps_list` and `omni_apps_disconnect` events with required properties.

## 9. Cleanup and removals checklist

### 9.1 Code removals

- Remove any code path that probes app state via repeated
  `ManageToolAuthorization(status)` calls.
- Remove the `auth` command file entirely (no alias).
- Remove the PostToolUse hook (`hooks/post-tool-surface-auth.mjs` + its `hooks.json` block).
- Remove dead helper code introduced solely for auth-language responses if not
  needed after apps-copy migration.

### 9.2 Behavior cleanup

- Ensure `/arcade:apps` is the only recommended app-management path.
- Ensure `do` and `tools` command descriptions do not instruct users to run
  auth-specific workflows for app listing/disconnect.
- Ensure error payloads for `Arcade_Apps` use `app_id_not_found` and do not leak
  internal provider ids in user-facing text.

## 10. Documentation updates checklist

Update all user-facing docs in the same change set:

- `README.md`
  - command list must be `do`, `apps`, `tools`
  - examples use `/arcade:apps` for list/disconnect
- `CHANGELOG.md`
  - include rename (`auth` -> `apps`), new `Arcade_Apps`, telemetry updates
- command files
  - `commands/apps.md` (new canonical)
  - `commands/auth.md` removed entirely (no alias)
- skills/agent prompts
  - apps language only
  - remove references to users running auth-specific list flows
- any release notes or marketplace copy
  - reflect new command and behavior

## 11. PR plan (ordered)

Open one PR per stage to keep risk low and review clear.

### PR 1 — Omni API + telemetry

Scope:
- Add `Arcade_Apps` with `list` and `disconnect`
- Derive `app_id` dynamically from live `provider_id` values
- Add PostHog events/properties (`omni_apps_list`, `omni_apps_disconnect`)

Required checks before merge:
- Unit tests:
  - list returns expected app grouping/counts
  - disconnect removes matching connections and is idempotent
  - unknown/stale app_id returns `app_id_not_found`
- Analytics tests:
  - both events emitted on success/error
  - required properties present
  - no sensitive fields logged

### PR 2 — Plugin commands/copy

Scope:
- Introduce `apps` command
- Keep `auth` alias for one release
- Update command/skill/agent text to apps language
- Update README + changelog

Required checks before merge:
- Plugin load sanity:
  - commands visible as `do`, `apps`, `tools` (plus temporary alias)
- Manual command run:
  - `/arcade:apps`
  - `/arcade:apps disconnect <app_id>`

### PR 3 — Alias removal (scheduled)

Scope:
- Remove `auth` alias after one release window
- Remove any leftover auth-first docs/copy

Gate:
- Confirm low/zero alias usage in PostHog before merge.

## 12. Deploy plan

### 12.1 Omni deploy

1. Deploy PR 1 to staging.
2. Smoke test staging:
   - `Arcade_Apps(list)` for a known user returns apps list in one call.
   - `Arcade_Apps(disconnect)` removes connections for one app_id.
   - Invalid/stale `app_id` returns `app_id_not_found`.
3. Verify telemetry in PostHog:
   - events present
   - required properties populated
   - no sensitive data fields.
4. Promote to production.

### 12.2 Plugin deploy

1. Merge PR 2.
2. Publish/update plugin package (marketplace path and zip artifact if used).
3. Verify install/upgrade flow:
   - new install shows `do`, `apps`, `tools`
   - existing install receives update and still supports temporary `auth` alias.

## 13. Post-deploy verification (must pass)

### Functional

- `apps` list:
  - returns quickly
  - no probing of many tools
  - no `404 tools not found` caused by guessed tool names
- `apps disconnect`:
  - first run disconnects
  - second run is safe/idempotent
- old alias:
  - `auth` works during migration window
  - logs usage for removal decision

### Analytics

- `omni_apps_list` appears for every list invocation.
- `omni_apps_disconnect` appears for every disconnect invocation.
- Error cases populate `error_code`, `error_class`, `engine_status_code`.
- `duration_ms` is set for both events.
- No auth URLs, token values, or raw account identifiers are present.

### UX/copy

- User-facing responses consistently use apps language.
- Internal plumbing terms do not appear in normal user answers.

## 14. Definition of done

All of the following are true:

1. PR 1 and PR 2 are deployed to production.
2. Acceptance criteria in §8 are all met.
3. Post-deploy verification in §13 passes.
4. Docs are updated per §10.
5. A dated follow-up issue is filed for PR 3 alias removal.
