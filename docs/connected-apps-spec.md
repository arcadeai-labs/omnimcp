# Connected Apps — Spec

Status: Draft / proposal
Owner: Arcade (Omni + plugin)
Scope: Omni MCP server changes + `arcade` plugin changes

## 1. Goal

Give users one clean way to **see, connect, and disconnect the apps** Arcade can
act on their behalf — Google, GitHub, Slack, Linear, Notion, Microsoft, Asana,
and so on.

Today there is no app-level surface. To answer "what's connected?" the agent
guesses a representative tool per provider and probes
`Arcade_ManageToolAuthorization(status)` — see the reference session that took
**14 calls and 3 `404 tool not found` errors** to produce one list, and still
couldn't disconnect anything. This spec replaces that with a first-class
**Apps** concept.

Good news from the code review: the **Engine primitives already exist and Omni
already calls them** (list connections + delete connection — see §5.2). The work
is almost entirely a new MCP surface + presentation, not backend plumbing.

## 2. Principles

1. **Users think in "apps," not plumbing.** The end user must never see the
   words *authorization*, *OAuth*, *scopes*, *tokens*, *providers*, or
   *connections*. They see **apps**, **connected / not connected**,
   **permissions**, **sign in**, **disconnect**, **switch account**.
2. **One authoritative list.** "What apps do I have?" is a single call, not N
   probes.
3. **No guessing.** The model never invents tool names to infer state.
4. **Symmetric verbs.** If a user can connect an app, they can disconnect it and
   switch the account.

## 3. Vocabulary mapping (internal → what the user sees)

| Internal concept | User-facing term |
|---|---|
| provider / `omni-google`, `omni-github` … | **App** ("Google", "GitHub") |
| toolkit (Gmail, Calendar, Drive) | **What it can do** / services within an app |
| authorization exists / token valid | **Connected** |
| no authorization | **Not connected** |
| OAuth flow / authorize URL | **Sign in** / **Connect** |
| revoke / delete token | **Disconnect** |
| reauthorize / switch_account | **Switch account** / **Reconnect** |
| scopes | **Permissions** (humanized labels) |
| account `sub` / login | **Connected as `<email/username>`** |

## 4. Data model

### 4.1 App

```jsonc
{
  "app_id": "google",                 // stable slug
  "name": "Google",                   // display name
  "connected": true,                  // any valid authorization present
  "account": "sam@arcade.dev",        // identity of the connected account, or null
  "services": ["Gmail", "Calendar", "Drive"],  // human list of what it powers
  "permissions": [                    // humanized, with granted state
    { "id": "gmail.send",        "label": "Send email",            "granted": true },
    { "id": "calendar.readonly", "label": "Read your calendar",    "granted": true },
    { "id": "drive.file",        "label": "Access files you open", "granted": true }
  ],
  "last_used": "2026-06-25T20:11:00Z" // optional
}
```

Notes:
- `connected` is app-level: true when the user has a connection with an active
  `connection_status` for any provider backing the app.
- `permissions` are the **scopes currently granted** on the connection
  (`UserConnection.scopes`), humanized. Arcade grants scopes incrementally (per
  tool, as used), so this reflects what's granted *now*. A task that needs a
  not-yet-granted permission surfaces at tool-use time via the requirements
  check (and triggers a "connect/upgrade" prompt) — it is not pre-computed in the
  list. `granted` is therefore `true` for everything `list` returns; it exists in
  the schema for forward-compat with a future "available but not granted" view.
- `account` comes from `UserConnection.provider_user_info`, already safe-filtered
  by Omni to `email`/`login`/`name`/`username` (`safeProviderUserInfo`).
- One app may be backed by **multiple providers/toolkits** (e.g. Microsoft →
  Outlook, OneDrive, SharePoint, Outlook Calendar). In practice these share one
  provider (`omni-microsoft`); the catalog (4.2) rolls them up by `provider_id`.

### 4.2 App catalog (Omni-owned)

A static overlay Omni maintains. `app_id` is the `provider_id` with the `omni-`
prefix stripped (`omni-google` → `google`). `connect_tool` is the representative
tool used to drive app-level `connect` (see §5.3):

```jsonc
{
  "google":    { "name": "Google",    "providers": ["omni-google"],    "services": ["Gmail","Calendar","Drive","Docs"], "connect_tool": "Gmail_WhoAmI" },
  "github":    { "name": "GitHub",    "providers": ["omni-github"],    "services": ["GitHub"],                         "connect_tool": "GitHub_WhoAmI" },
  "slack":     { "name": "Slack",     "providers": ["omni-slack"],     "services": ["Slack"],                          "connect_tool": "Slack_ListConversations" },
  "linear":    { "name": "Linear",    "providers": ["omni-linear"],    "services": ["Linear"],                         "connect_tool": "Linear_ListIssues" },
  "notion":    { "name": "Notion",    "providers": ["omni-notion"],    "services": ["Notion"],                         "connect_tool": "NotionToolkit_WhoAmI" },
  "asana":     { "name": "Asana",     "providers": ["omni-asana"],     "services": ["Asana"],                          "connect_tool": "Asana_ListWorkspaces" },
  "microsoft": { "name": "Microsoft", "providers": ["omni-microsoft"], "services": ["Outlook","OneDrive","SharePoint","Outlook Calendar"], "connect_tool": "MicrosoftOnedrive_WhoAmI" }
}
```

The provider list and `app_id`s can be derived automatically from the allowlist +
tool requirements (§5.5); this static table only adds display names, the human
"services" grouping, and the `connect_tool`. Pick each `connect_tool` from a tool
known to exist in the catalog (the reference session's `*_WhoAmI` calls confirm
several) so `connect` never 404s.

### 4.3 Permission humanization

A scope → label dictionary owned by Omni (fallback to a generic label for
unknown scopes), e.g.:

| Scope | Label |
|---|---|
| `https://www.googleapis.com/auth/gmail.send` | Send email |
| `https://www.googleapis.com/auth/calendar.readonly` | Read your calendar |
| `https://www.googleapis.com/auth/drive.file` | Access files you open with Arcade |
| `channels:read` | Read channel list |
| `Files.Read` | Read your files |
| `read` (Linear) | Read your issues |

## 5. Omni (server) changes

### 5.1 New meta-tool: `Arcade_Apps`

Replaces app-management duties; `Arcade_ManageToolAuthorization` stays for
low-level per-tool repair (and as the mechanism this calls under the hood).

```
Arcade_Apps(action, app_id?, query_id?)
```

| `action` | Args | Returns |
|---|---|---|
| `list` | — | `{ "apps": [App, …] }` (every app in the catalog, connected or not) |
| `connect` | `app_id` | `{ "app_id", "connect_url", "message" }` — the "sign in" link |
| `disconnect` | `app_id` | `{ "app_id", "connected": false }` — revokes all authorizations for the app |
| `switch_account` | `app_id` | `{ "app_id", "connect_url" }` — disconnect + fresh sign-in |

Design rules:
- `list` is **one call**, authoritative, provider-agnostic to the caller.
- All responses use the App model in §4.1 (humanized permissions, friendly
  names). No raw scopes/provider ids in the user-visible fields (keep raw values
  in an optional `_debug` block if useful for the model).
- `connect` drives the catalog's representative `connect_tool` for the app
  (§5.3), so a first connect works without the user naming a specific tool.

### 5.2 How each action maps to today's Engine API

**list, disconnect, and switch_account need no new Engine endpoints.** Omni
already calls all of them today in the `reauthorize`/`switch_account` path of
`Arcade_ManageToolAuthorization` (`internal/tools/manage_tool_authorization.go`
→ `resetAndAuthorize`). The typed methods already exist in
`internal/engine/client.go`; `Arcade_Apps` just re-shapes them around apps.

| Apps action | Existing Engine call(s) | Omni client method (exists today) |
|---|---|---|
| `list` | `GET /v1/admin/user_connections?user_id=<verified-user>` (omit `provider_id` → every app) | `ListUserConnections(userID, "")` |
| `disconnect` | `GET /v1/admin/user_connections?...&provider_id=` then `DELETE /v1/admin/user_connections/{id}` per connection | `ListUserConnections` + `DeleteUserConnection` |
| `switch_account` | delete connections + `POST /v1/tools/authorize` | already implemented as `resetAndAuthorize` |
| `connect` | `POST /v1/tools/authorize` for a representative tool of the app | `AuthorizeTool` |

Each `UserConnection` already carries everything the App model needs:
`provider_id`, `scopes`, `connection_status`, and `provider_user_info`
(→ "Connected as"). So `Arcade_Apps(list)` is **one** `ListUserConnections` call,
grouped by `provider_id` and overlaid with the catalog — replacing the 14-call,
3×404 probing session entirely.

`GET/DELETE /v1/admin/user_connections` require **admin auth**, which Omni already
uses via its project API key (`doJSON(..., admin=true)`).

### 5.3 The only real gap: app-level connect

Authorization is **tool-centric** — `POST /v1/tools/authorize` takes a `tool_name`,
and there is no provider-level "authorize this app with its baseline scopes"
endpoint. So `connect(app_id)` must pick a representative tool whose auth covers
the app's baseline scopes and call `AuthorizeTool`. The catalog (§4.2) supplies a
`connect_tool` per app (e.g. a low-scope read or `*_WhoAmI`).

Optional future Engine work: a provider-level authorize endpoint
(`POST /v1/auth/authorize { provider_id, scopes }`) so `connect` doesn't lean on a
representative tool. **Not required for v1.**

### 5.4 Security

`list`/`disconnect` use the admin API key and take a `user_id`. Omni MUST pass the
**verified** Arcade user id from the MCP request identity (the same one it binds
for tool execution) and never a caller-supplied value — otherwise a caller could
enumerate or delete another user's connections.

### 5.5 Catalog source

Derive the catalog from the **allowlist** (`tools.allowed_tools` /
`OMNI_TOOLS_ALLOWED`) plus each tool's `provider_id` (from the tool spec /
`/v1/tools/requirements`): group allowed toolkits by `provider_id`, strip the
`omni-` prefix for `app_id` (`omni-google` → `google`), and overlay a small static
table for display names, the human "services" list, and the `connect_tool`. The
catalog is also what lets `list` show **not-connected** apps — the admin endpoint
only returns connections that already exist.

### 5.6 Phasing

- **Phase 1 (no Engine changes):** `Arcade_Apps(list, disconnect, switch_account)`
  on the endpoints Omni already calls, plus `connect` via a representative tool
  from the catalog. This already delivers the full see / connect / disconnect /
  switch experience and removes the probing/404s.
- **Phase 2 (optional polish):** provider-level authorize endpoint for cleaner
  `connect`; richer permission metadata if Engine adds it.

## 6. Plugin (`arcade`) changes

All user-facing names move from "auth/authorization" to **apps**.

### 6.1 Command rename

- `commands/auth.md` → `commands/apps.md` → **`/arcade:apps`**
  - Description: "See and manage your connected apps (Google, Slack, GitHub, …)."
  - Behavior: delegate to the `apps-agent` subagent; default to listing apps,
    and handle "connect/disconnect/switch" phrasing in `$ARGUMENTS`.

### 6.2 Skill rename

- `skills/arcade-authorization/` → `skills/arcade-apps/`
  - `name: arcade-apps`
  - Teaches the **voice rules** (§6.5) and the `Arcade_Apps` flow.

### 6.3 New subagent

- `agents/apps-agent.md` (`name: apps-agent`)
  - Description: "Use when the user asks what apps are connected, or wants to
    connect, disconnect, or switch the account for an app."
  - Runs `Arcade_Apps(list)` and renders a table; uses `connect` / `disconnect`
    / `switch_account` for actions. Inherits MCP tools (no `tools:` allowlist —
    see the v0.2.1 fix).

### 6.4 Copy changes in existing components

- `arcade-operator` / `inbox-agent` / `schedule-agent`: when a tool needs auth,
  say *"You need to connect your **Google** app — sign in here: `<url>`"* — never
  "authorization required."
- `hooks/post-tool-surface-auth.mjs`: change the injected text from "Omni needs
  authorization…" to "Arcade needs you to **connect the `<App>` app**. Share this
  sign-in link…".
- `session-start-availability.mjs`: "If an app isn't connected yet, the user can
  run `/arcade:apps` to connect it."

### 6.5 Voice rules (bake into the apps skill)

- Say **app**, **connected / not connected**, **sign in / connect**,
  **disconnect**, **switch account**, **permissions**.
- Never say authorization, OAuth, scopes, tokens, providers, connections.
- Show **Connected as `<account>`** when known.
- Present permissions as friendly labels, not scope strings.

## 7. UX flows (what the user sees)

**"What apps do I have?"**
> **Connected**
> • **Google** — connected as sam@arcade.dev — Gmail, Calendar, Drive
> • **GitHub** — connected
> • **Slack** — connected (read access)
> • **Linear** — connected
> • **Microsoft** — connected — OneDrive
>
> **Not connected:** Notion, Asana
>
> Want to connect one? Just say "connect Notion."

**"Connect Notion"** → returns a sign-in link.
**"Disconnect Slack"** → "Slack disconnected."
**"Switch my Google account"** → sign-in link for a different account.

(One `Arcade_Apps(list)` call instead of 14 probes; zero invented tool names.)

## 8. Backward compatibility

- `Arcade_ManageToolAuthorization` remains for per-tool repair and as the
  underlying mechanism. `Arcade_Apps` is the new, preferred surface.
- Plugin: keep `/arcade:auth` as a hidden alias of `/arcade:apps` for one
  release, then drop it.

## 9. Open questions

1. **Partial connection UX:** how to present an app that's connected but missing
   a permission a task needs (upgrade-in-place vs. reconnect)? The list reflects
   granted scopes only; the gap is detected at tool-use time.
2. **Connect scope bundle:** app-level `connect` drives a representative
   `connect_tool`, so it requests *that tool's* scopes. Is one representative tool
   enough to feel "connected," or should `connect` pre-warm a broader baseline
   (which only a provider-level authorize endpoint, §5.3, would do cleanly)?
3. **`connect_tool` maintenance:** the representative tool per app is hand-picked.
   Worth a tiny validation/test that each `connect_tool` exists in the live
   catalog so it never regresses to a 404.
4. **Icons/branding** for an eventual visual picker (out of scope for MCP text,
   relevant for dashboards).

> Resolved by the code review: there is **no need for a net-new Engine
> list/revoke endpoint** (both exist and Omni already calls them), and **account
> identity is already available** via `provider_user_info`. Earlier drafts listed
> these as open dependencies.
