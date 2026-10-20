# Plugin telemetry

**Telemetry is off in this build.** The plugin sends no usage events, and
`npm run generate` writes no telemetry hooks into any client manifest. This
build also ships no PostHog key, and `hooks/telemetry-send.mjs` exits without
reading the environment or contacting a server.
`TELEMETRY_ENABLED` in `hooks/telemetry-config.mjs` stays `false` until
collection is separately approved after ingestion, opt-outs, privacy, and
distribution requirements are verified.

The sections below describe what **would** be sent when telemetry is turned on,
its privacy and opt-out controls, and the approval required before enabling it.
Nothing here implies that this package currently transmits data.

When enabled, Claude Code and Copilot CLI hooks would inspect prompts locally
in each session to recognize app-related work. Relevance state belongs to that
session; it does not carry between sessions. Prompts classified as unrelated
would send no event. Direct Arcade tool calls would remain observable even
without a classified prompt. Alternative MCP, CLI, and web tools would send
events only during app-related work.

Events would carry hashed session IDs, with no ID lasting across sessions. They
would exclude prompt text, commands, app data, names, email addresses, and Arcade
account IDs. These observations do not establish task success or whether
Arcade was needed. Install and signed-in-user counts require gateway data.

## Prompt scope

A prompt matching the local app classifier or mentioning Arcade would open a
30-minute observation period for its session. A short explicit confirmation such
as “yes, send it” would continue that period without extending its expiry. An
unrelated substantive prompt would close it. Background task notifications would
leave the current period unchanged. Expired, absent, or invalid state would
produce no alternative-tool telemetry.

`could_use_arcade` and `service_hints` describe keywords in the current prompt,
not the preceding task. A confirmation reply can therefore send a scoped prompt
event with `could_use_arcade: false` and no service hints. Keyword matching can
misclassify prompts; the labeled evaluation measures that limitation separately.

Session starts send no usage event. Only the Arcade operator's stop reports
send subagent events. Claude Code adds its routing reminder on every prompt
except short acknowledgements and background task results, whether or not
telemetry is on. Copilot CLI has no routing reminder hook, so `reminder_sent`
stays false there.

## Opt-outs when telemetry is on

While `TELEMETRY_ENABLED` is `false`, these switches are inert but documented
for a future enabled build. They are implemented in `hooks/telemetry-run.mjs`
and each client's adapter in `hooks/telemetry-adapters/`.

Set `ARCADE_PLUGIN_TELEMETRY=0` in your environment, or in Claude Code's
`settings.json`:

```json
{ "env": { "ARCADE_PLUGIN_TELEMETRY": "0" } }
```

`false`, `off`, and `no` also work. Telemetry is also off when `DO_NOT_TRACK`
is set to any non-empty value other than `0`, `false`, `off`, or `no`. In
Claude Code, `DISABLE_TELEMETRY` and `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`
opt out when set to **any** non-empty value (including `0` and `false`), matching
Claude's own telemetry switches.

With telemetry opted out, the client still invokes its configured Node hooks.
The telemetry hook exits before classifying the prompt or storing state. Claude
Code's routing hook still adds its reminder. An environment variable cannot
remove hooks from the manifest.

In Copilot CLI, set `ARCADE_PLUGIN_TELEMETRY` to `0`, `false`, `off`, or `no`
in your shell before starting `copilot`. Any other value, including an unset
variable, leaves that switch inactive. `COPILOT_OFFLINE` turns telemetry off
when it is set to any non-empty value other than `0`, `false`, `off`, or `no`.
An unset or empty `COPILOT_OFFLINE`, and those four values, leave telemetry on
through this switch.

## Where it runs

The Claude Code and Copilot CLI adapters are the only ones wired for telemetry
in `hooks/hook-hosts.mjs` (`hooks/telemetry-adapters/claude-code.mjs` and
`hooks/telemetry-adapters/copilot-cli.mjs`). Claude maps MCP tools under
`mcp__plugin_<plugin>_<mcpServer>__` (this plugin's gateway) and
`mcp__claude_ai_arcade__` (the claude.ai Arcade connection). Attempt events
(`PreToolUse`) are emitted only for those two prefixes. Copilot maps MCP tools
as `<server>-<tool>` (for example `arcade-Arcade_SelectTools` when the MCP
server name matches `mcp.json`). Copilot sends no `turn`, no `PreToolUse`
attempt events, and no built-in CLI or web tool events.

Claude ties alternative-tool observations to the hashed `turn` for the
current `prompt_id` (`requiresTurn: true`). Copilot keeps prompt scope per
`session` without a prompt ID (`requiresTurn: false`).

Local state uses `CLAUDE_PLUGIN_DATA` (Claude Code) and `COPILOT_PLUGIN_DATA`
(Copilot CLI) for `arcade-used` and `prompt-scope/` files.

Copilot's manifest is shared with VS Code's Copilot sessions, which support
session and subagent routing hooks (see the [VS Code guide](install/vscode.md)).
`runOnlyIfScriptExists` is a defensive guard for a missing plugin path or script,
not a VS Code capability limit. No telemetry hooks are generated while
`TELEMETRY_ENABLED` is `false`; VS Code telemetry remains unvalidated, and
routing-hook support does not establish telemetry delivery or opt-out behavior.
Cursor is not wired up; its hook input can include the user's email. claude.ai,
ChatGPT, Codex, and OpenCode don't run telemetry hooks from this package.

### What CI exercises

| Adapter | Tested in this repo | Not covered here |
| --- | --- | --- |
| Claude Code | In-process hook captures, contract tests, `claude plugin validate --strict` on **2.1.258** (runs on the committed manifest, which has no telemetry hooks; no CLI has validated a manifest with telemetry hooks enabled) | Live user sessions, IDE extensions, desktop Code tab, Cowork delivery and opt-out |
| Copilot CLI | In-process captures, fixture JSON, contract tests, `npm run verify:copilot` on **1.0.88** (runs on the committed manifest, which has no telemetry hooks; checks only MCP servers and skills; no CLI has validated a manifest with telemetry hooks enabled) | Live sessions, Windows PowerShell hook commands, VS Code agent sessions |

None of these checks prove end-user transmission while `TELEMETRY_ENABLED` is
`false`. The in-process tests exercise adapter behavior for an enabled build.

## What is stored on your machine

When telemetry is enabled, each client's plugin data folder contains its own
`arcade-used` flag, readable only by you. It holds `true` after an Arcade call
succeeds in that client plugin installation and supplies `arcade_used_before`.

Prompt relevance state lives in `prompt-scope/<sha256(host:session_id)>.json` in
the same folder. It contains a relevance boolean, expiry timestamp, and optional
hashed prompt ID that ties tool calls to their prompt. It contains no prompt text,
commands, tool arguments, or service content. Expired state cannot authorize
observation. The next prompt-state write removes expired or malformed entries;
at most 256 session state files are retained. Session start clears that
session's state, except after Claude Code compacts the conversation. Claude
alternative-tool observations require a matching hashed prompt ID; an absent
prompt ID cannot authorize those observations.

- Claude Code: `~/.claude/plugins/data/<plugin id>/`
- Copilot CLI: `~/.copilot/plugin-data/<…>/`

If the client supplies no plugin data folder, the plugin sends nothing.

## What is sent

<!-- BEGIN generated from hooks/telemetry-contract.mjs by `npm run generate`; edit that file, not this block -->
Every event has these properties:

| Property | Value |
| --- | --- |
| `distinct_id` | the same value as `session` |
| `session` | `sha256(session_id)`, first 16 hex characters, where `session_id` is the client's random ID for the session |
| `turn` | `sha256(session_id + ":" + prompt_id)`, first 16 hex characters; Claude Code only, because Copilot CLI has no prompt ID |
| `arcade_used_before` | whether an Arcade tool call had succeeded for this client plugin installation before this event (from the `arcade-used` file) |
| `host` | `claude-code` \| `copilot-cli` |
| `telemetry_version` | `2`, the scoped event contract; earlier events have no version |
| `plugin_version` | from `VERSION` |
| `os` | `darwin` \| `linux` \| `win32` \| `other` |
| `$process_person_profile` | `false` |
| `$geoip_disable` | `true` |
| `$ip` | `0.0.0.0`, so PostHog stores this instead of your real IP address |

Events and their extra properties:

| Event | When | Extra properties |
| --- | --- | --- |
| `Plugin prompt submitted` | UserPromptSubmit, only for locally classified app work and short confirmations of that work; background task results are excluded. In Copilot CLI a relevant subagent prompt also sends it | `could_use_arcade`: boolean, a local keyword guess (see below). `service_hints`: service categories the prompt mentions. `reminder_sent`: boolean, whether the routing reminder was added (always `false` in Copilot CLI). |
| `Plugin tool attempted` | PreToolUse, in Claude Code, before an MCP call through this plugin's Arcade gateway or the claude.ai Arcade connection; an attempt does not show whether the tool finished | `server`: `arcade` (this plugin's gateway) \| `other_arcade` (the claude.ai Arcade connection). `tool`: only for `arcade` and `other_arcade`: an exact gateway tool name, `app_tool` for a recognized service category, or `other`; app tool names are never sent. `service`: the service category, when the tool, the app tool passed to `Arcade_UseTool`, or the server name matches one. |
| `Plugin tool called` | PostToolUse, on Arcade tools, or alternative MCP tools while the current turn concerns app work | `server`: `arcade` (this plugin's gateway) \| `other_arcade` (another connection exposing Arcade's gateway tools) \| `other`. `tool`: only for `arcade` and `other_arcade`: an exact gateway tool name, `app_tool` for a recognized service category, or `other`; app tool names are never sent. `service`: the service category, when the tool, the app tool passed to `Arcade_UseTool`, or the server name matches one. `auth_needed`: only for `System_ManageAuthorization`: whether its answer says a service still needs sign-in. |
| `Plugin tool failed` | PostToolUseFailure, on Arcade tools, or alternative MCP tools while the current turn concerns app work | `server`: `arcade` (this plugin's gateway) \| `other_arcade` (another connection exposing Arcade's gateway tools) \| `other`. `tool`: only for `arcade` and `other_arcade`: an exact gateway tool name, `app_tool` for a recognized service category, or `other`; app tool names are never sent. `service`: the service category, when the tool, the app tool passed to `Arcade_UseTool`, or the server name matches one. `failure_kind`: picked on your machine from the error message; the message is not sent: `auth_required` \| `session_expired` \| `unreachable` \| `timeout` \| `http_error` \| `interrupted` \| `tool_error`. |
| `Plugin built-in tool called` | PostToolUse, Claude Code only, on `WebFetch` and `WebSearch`, and on `Bash` commands that run `gh` \| `glab` \| `curl` \| `wget` \| `http` \| `osascript`; only while the current turn concerns app work | `tool`: `Bash` \| `WebFetch` \| `WebSearch`. `cli`: only for `Bash`: the program the command runs, `gh` \| `glab` \| `curl` \| `wget` \| `http` \| `osascript`. `service`: the program's service category, only for `gh` \| `glab`: `code_hosting`. |
| `Plugin built-in tool failed` | PostToolUseFailure, Claude Code only, on `WebFetch` and `WebSearch`, and on `Bash` commands that run `gh` \| `glab` \| `curl` \| `wget` \| `http` \| `osascript`; only while the current turn concerns app work | `tool`: `Bash` \| `WebFetch` \| `WebSearch`. `cli`: only for `Bash`: the program the command runs, `gh` \| `glab` \| `curl` \| `wget` \| `http` \| `osascript`. `service`: the program's service category, only for `gh` \| `glab`: `code_hosting`. |
| `Plugin subagent stopped` | SubagentStop, only for arcade-operator | `agent`: `arcade-operator`. `status`: only for `arcade-operator`: the status line of its final report, `completed` \| `needs_auth` \| `needs_confirmation` \| `needs_clarification` \| `failed` \| `unknown`. `subagent_session`: `sha256(agent_id)`, first 16 hex characters. In Copilot CLI the subagent's own events carry this as `session`. |

Service categories: `email`, `calendar`, `chat`, `issues`, `docs`, `meetings`, `crm`, `code_hosting`, `analytics`, `storage`.
<!-- END generated telemetry tables -->

`could_use_arcade` is a local keyword guess (in
`hooks/telemetry-classify.mjs`) at whether the prompt is a task Arcade could
do: email, calendar, chat, and the other categories above.

`failure_kind`, `auth_needed`, and `cli` are values from fixed lists, picked
on your machine. The error text, the tool output, and the command they are
picked from are never sent. During an app-related observation period, a Bash
command sends an event only when one of its
commands starts with a listed program; commands that call a program by its
full path, such as `/opt/homebrew/bin/gh`, are not counted. A command that runs
two listed programs, such as `gh … && curl …`, sends one event for each.
Claude Code starts these hooks only for commands that match (the hook `if` field, Claude Code 2.1.246 and later).

## Never sent

- prompt text, or any text you or the model wrote
- tool inputs, tool outputs, or error messages
- commands, their arguments, URLs, and search queries
- file paths, the working directory, or transcript paths
- names of MCP servers other than Arcade's, or their tool names
- names of subagents other than Arcade's
- your email, username, hostname, repository, or Arcade account

The plugin drops any property not listed on this page before sending.

PostHog would see the IP address the request comes from, like any web request,
but would not store it: every event sets `$ip` to `0.0.0.0`, and location
lookup is off.

## Gateway telemetry

The Arcade MCP gateway (`https://api.arcade.dev/mcp/arcade`) remains the
canonical source for request, authentication, discovery, tool-call, and
completion telemetry. Plugin events are supplemental observations from client
hooks. They do not replace gateway records and cannot prove task success on
their own.

## Observation limits

Plugin events describe what hooks observed. They do not establish whether Arcade
was needed or whether a user's task succeeded. `could_use_arcade` and
`service_hints` are local keyword classifications, and unrelated prompts are
excluded. Neither host sends a task ID.

Claude Code supplies a hashed `turn`; Copilot CLI supplies only a hashed
`session`, which can contain multiple prompts. Detached delivery can change
event arrival order. Tool attempts, completions, and failures are separate
observations; timestamps alone cannot pair calls or establish a task outcome.

MCP server and gateway tool names are recognition heuristics, not verified
connection provenance. Copilot's server names do not identify which plugin
installed them. Operator stop events can link a child session to its parent;
missing stops and other subagents leave that attribution incomplete. Session
hashes do not link activity across sessions.

`failure_kind` is classified locally from error text, and `auth_needed` reflects
the authorization tool's response. An operator's `status` is the model's report
of its own work. These values are not verified server status or task-success
signals. Routing quality requires labeled evaluations outside this telemetry.

## Routing evaluation

Evaluate classification and client routing on controlled, labeled cases separately
from production usage events. Include implicit app requests, contextual follow-ups,
and local coding tasks that name an app. Fixture accuracy does not establish
real-user routing quality.

The existing [Tool Recommendation Cost Eval](https://github.com/ArcadeAI/tool-recommendation-cost-eval)
provides an offline cross-client harness and published results. Record the plugin
SHA and client configuration when evaluating the plugin; Tool Recommendation
on/off results do not establish the plugin's effect on routing or cost. Plugin
telemetry and that harness are complementary; neither replaces the other.

## Before turning it on

Separate approval is required before setting `TELEMETRY_ENABLED` to `true` and
shipping telemetry hooks. Confirm, outside this repository:

- user-facing disclosure and privacy policy coverage for plugin usage events
- analytics retention and processor handling for the PostHog project
- verified ingestion per client and `telemetry_version` for the build under review
- opt-out switches verified on each supported client surface
- applicable store or distribution decisions for builds that transmit data

The change that turns telemetry on also has to add an event sender to
`hooks/telemetry-send.mjs`, a PostHog project key to
`hooks/telemetry-config.mjs`, and a call to `clearSessionScope` in
`hooks/session-start.mjs`, and update the test in
`dev/test/telemetry-off.test.mjs` that checks this build ships none of them.
Tests can't point the sender at a local server until it reads a host override
again.

These are release acceptance requirements; the current code and CI do not
enforce them. A repository install can consume a branch before a GitHub release
is tagged, so a branch install can transmit data before any release is tagged.
