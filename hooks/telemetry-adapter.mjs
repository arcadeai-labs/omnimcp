// @ts-check
/**
 * The interface between the shared telemetry code and each client. A client
 * runs telemetry when its HOSTS entry in hook-hosts.mjs names an adapter in
 * `telemetry`; the adapter lives in hooks/telemetry-adapters/<host>.mjs and
 * default-exports a TelemetryAdapter. Removing that file and that HOSTS field
 * removes the client without touching the shared code or other clients.
 */

import { TELEMETRY_HOSTS } from "./telemetry-contract.mjs";

/**
 * Hook input in Claude Code's field names. Adapters translate their client's
 * input into this shape; the shared code reads nothing else.
 * @typedef {object} HookInput
 * @property {string} [hook_event_name] Claude Code's name for the hook.
 * @property {string} [session_id]
 * @property {string} [prompt_id]
 * @property {string} [source] SessionStart source, e.g. "compact".
 * @property {unknown} [prompt]
 * @property {unknown} [tool_name]
 * @property {Record<string, any>} [tool_input]
 * @property {unknown} [tool_response] The tool's result, read only to classify sign-in answers.
 * @property {unknown} [error]
 * @property {unknown} [is_interrupt]
 * @property {unknown} [agent_type]
 * @property {unknown} [agent_id]
 * @property {unknown} [last_assistant_message]
 */

/**
 * One telemetry hook entry the generator writes for this client. `event` is
 * Claude Code's name; the client's `events` map in hook-hosts.mjs translates
 * it. `if` and `extraArgs` work only in the nested (Claude Code) format.
 * @typedef {object} HookRow
 * @property {string} event
 * @property {string} [matcher]
 * @property {string} [if]
 * @property {string[]} [extraArgs]
 */

/**
 * @typedef {{ name: string, anyValue: boolean }} OptOutSwitch
 *   A client's own off switch. `anyValue: true`: any non-empty value turns
 *   telemetry off. `anyValue: false`: any value except empty, 0, false, off,
 *   or no does.
 */

/**
 * @typedef {Record<string, string>} ToolProperties
 *   Contract properties for an MCP tool event (`server`, `tool`, `service`), or
 *   for a built-in tool event (`tool`, `cli`, `service`).
 */

/**
 * @typedef {object} TelemetryAdapter
 * @property {typeof TELEMETRY_HOSTS[number]} host The `host` property on every event.
 * @property {string} dataVariable Environment variable naming the plugin's data folder.
 * @property {OptOutSwitch[]} optOutSwitches
 * @property {boolean} requiresTurn Whether tool events count as app work only
 *   with the same prompt ID as the prompt that opened scope. Without it, a
 *   tool event inherits its session's scope.
 * @property {boolean} promptReminder Whether the client runs user-prompt-submit.mjs.
 * @property {boolean} subagentSession Whether SubagentStop events carry `subagent_session`.
 * @property {HookRow[]} hookRows
 * @property {(raw: Record<string, any>) => HookInput} normalize
 * @property {(toolName: unknown, toolInput: Record<string, any> | undefined) => ToolProperties | null} toolProperties
 * @property {(toolName: unknown, toolInput: Record<string, any> | undefined) => ToolProperties | null} [attemptProperties]
 *   Only for clients with a PreToolUse row.
 * @property {(toolName: unknown, toolInput: Record<string, any> | undefined, cli: string | undefined) => ToolProperties | null} [builtinToolProperties]
 *   Only for clients that report built-in CLI and web tools.
 */

/**
 * Loads the adapter for a contract host. Throws for any other name.
 * @param {string} host
 * @returns {Promise<TelemetryAdapter>}
 */
export const loadTelemetryAdapter = async (host) => {
  if (!(/** @type {readonly string[]} */ (TELEMETRY_HOSTS)).includes(host)) {
    throw new Error(`${host} is not a telemetry host in hooks/telemetry-contract.mjs`);
  }
  const adapter = (await import(new URL(`./telemetry-adapters/${host}.mjs`, import.meta.url).href)).default;
  if (adapter?.host !== host) throw new Error(`hooks/telemetry-adapters/${host}.mjs does not export the ${host} adapter`);
  return adapter;
};
