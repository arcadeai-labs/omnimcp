// @ts-check
/**
 * Turns normalized hook input into a telemetry event. Pure: no I/O.
 * What may be sent is defined in telemetry-contract.mjs.
 */

import { createHash } from "node:crypto";
import { isTaskNotification, shouldRemind } from "./prompt-filters.mjs";
import { isOperatorAgentType } from "./routing-guidance.mjs";
import {
  classifyPrompt,
  serviceForToolkit,
  serviceForToolName,
} from "./telemetry-classify.mjs";
import { commandUsesCli } from "./telemetry-commands.mjs";
import {
  allowedProperties,
  BASH_CLIS,
  CLI_SERVICES,
  GATEWAY_TOOLS,
  OPERATOR_STATUSES,
  OS_NAMES,
} from "./telemetry-contract.mjs";
import { PLUGIN_VERSION } from "./telemetry-config.mjs";
import { authNeeded, failureKind } from "./telemetry-failures.mjs";

/** @typedef {import("./telemetry-adapter.mjs").TelemetryAdapter} TelemetryAdapter */
/** @typedef {import("./telemetry-adapter.mjs").HookInput} HookInput */

// Matches the operator's report line, e.g. "status: needs_auth", with or
// without markdown around it. "unknown" is what we send when none matches.
const OPERATOR_STATUS = new RegExp(
  `^[^\\w\\n]*status[^\\w\\n]*(${OPERATOR_STATUSES.filter((s) => s !== "unknown").join("|")})\\b`,
  "im",
);

// The client's session ID is random, new for each session, and never sent,
// so it works as the salt: nothing links one session's hashes to another's.
export const shortHash = (/** @type {string} */ text) =>
  createHash("sha256").update(text).digest("hex").slice(0, 16);

/**
 * @param {unknown} value
 * @param {readonly string[]} allowed
 * @param {string} fallback
 */
const oneOf = (value, allowed, fallback) =>
  typeof value === "string" && allowed.includes(value) ? value : fallback;

/**
 * @param {Record<string, string>} properties
 * @param {string | null | undefined} service
 */
const withService = (properties, service) =>
  service ? { ...properties, service } : properties;

/**
 * @param {string} server
 * @param {string} tool
 * @param {Record<string, any> | undefined} toolInput
 */
export const arcadeToolProperties = (server, tool, toolInput) => {
  // Arcade_UseTool names the app tool in its input, e.g. "Gmail.ListEmails".
  const service =
    tool === "Arcade_UseTool"
      ? serviceForToolName(toolInput?.tool_name)
      : serviceForToolName(tool);
  // A recognized toolkit prefix does not establish that its tool name is public.
  const isGateway = /** @type {readonly string[]} */ (GATEWAY_TOOLS).includes(tool);
  const category = isGateway ? tool : service !== null ? "app_tool" : "other";
  return withService({ server, tool: category }, service);
};

/**
 * @param {string | null | undefined} service Contract service category (e.g. `email`), when known.
 */
export const otherServerProperties = (service) => withService({ server: "other" }, service);

/**
 * Properties for a tool on an MCP server other than this plugin's Arcade
 * server. A gateway tool name means another Arcade server. Some connectors
 * name the service in the server, not the tool (e.g. claude_ai_Gmail); only
 * the category is sent.
 * @param {string} server
 * @param {string} tool
 * @param {Record<string, any> | undefined} toolInput
 */
export const otherServerToolProperties = (server, tool, toolInput) => {
  if (/** @type {readonly string[]} */ (GATEWAY_TOOLS).includes(tool)) {
    return arcadeToolProperties("other_arcade", tool, toolInput);
  }
  const service =
    serviceForToolName(tool) ?? server.split(/[^A-Za-z0-9]+/).map(serviceForToolkit).find(Boolean);
  return otherServerProperties(service);
};

/**
 * Properties for a WebFetch, WebSearch, or listed-CLI Bash call, or null to
 * send nothing. Only the tool name and the CLI name are read into the event;
 * the command, its description, URLs, and queries never are.
 * @param {unknown} toolName
 * @param {Record<string, any> | undefined} toolInput
 * @param {string | undefined} cli
 */
export const builtinToolProperties = (toolName, toolInput, cli) => {
  if (toolName === "WebFetch" || toolName === "WebSearch") return { tool: toolName };
  if (toolName !== "Bash" || typeof cli !== "string") return null;
  if (!(/** @type {readonly string[]} */ (BASH_CLIS).includes(cli))) return null;
  // `cli` comes from the hook entry's `if` condition. Checking the command as
  // well keeps a client that ignores `if` from reporting every CLI on every
  // Bash call.
  if (!commandUsesCli(toolInput?.command, cli)) return null;
  return withService({ tool: "Bash", cli }, CLI_SERVICES[cli]);
};

const operatorStatus = (/** @type {unknown} */ message) => {
  const match = typeof message === "string" && message.match(OPERATOR_STATUS);
  return match ? match[1].toLowerCase() : "unknown";
};

/**
 * @param {unknown} prompt
 * @param {TelemetryAdapter} adapter
 */
const promptProperties = (prompt, adapter) => {
  const { couldUseArcade, serviceHints } = classifyPrompt(prompt);
  return {
    could_use_arcade: couldUseArcade,
    service_hints: serviceHints,
    reminder_sent: adapter.promptReminder && shouldRemind(prompt),
  };
};

// The parent's SubagentStop names the subagent's session ID as agent_id.
const subagentSession = (/** @type {unknown} */ agentId) =>
  typeof agentId === "string" && agentId !== "" ? { subagent_session: shortHash(agentId) } : {};

/**
 * Returns [event name, extra properties], or null for untracked input.
 * @param {HookInput} input
 * @param {TelemetryAdapter} adapter
 * @param {string | undefined} cli
 * @param {boolean} appWork
 * @returns {[string, Record<string, unknown>] | null}
 */
const eventFor = (input, adapter, cli, appWork) => {
  switch (input.hook_event_name) {
    case "SessionStart":
      return null;
    case "UserPromptSubmit":
      if (isTaskNotification(input.prompt) || !appWork) return null;
      return ["Plugin prompt submitted", promptProperties(input.prompt, adapter)];
    case "PreToolUse": {
      const extra = adapter.attemptProperties?.(input.tool_name, input.tool_input);
      return extra ? ["Plugin tool attempted", extra] : null;
    }
    case "PostToolUse": {
      const builtin = adapter.builtinToolProperties?.(input.tool_name, input.tool_input, cli);
      if (builtin && appWork) return ["Plugin built-in tool called", builtin];
      const extra = adapter.toolProperties(input.tool_name, input.tool_input);
      if (!extra || (extra.server === "other" && !appWork)) return null;
      if (extra.tool === "System_ManageAuthorization") {
        return ["Plugin tool called", { ...extra, auth_needed: authNeeded(input.tool_response) }];
      }
      return ["Plugin tool called", extra];
    }
    case "PostToolUseFailure": {
      const builtin = adapter.builtinToolProperties?.(input.tool_name, input.tool_input, cli);
      if (builtin && appWork) return ["Plugin built-in tool failed", builtin];
      const extra = adapter.toolProperties(input.tool_name, input.tool_input);
      if (!extra || (extra.server === "other" && !appWork)) return null;
      return ["Plugin tool failed", { ...extra, failure_kind: failureKind(input.error, input.is_interrupt) }];
    }
    case "SubagentStop": {
      const session = adapter.subagentSession ? subagentSession(input.agent_id) : {};
      if (!isOperatorAgentType(input.agent_type)) {
        return null;
      }
      return [
        "Plugin subagent stopped",
        {
          agent: "arcade-operator",
          status: operatorStatus(input.last_assistant_message),
          ...session,
        },
      ];
    }
    default:
      return null;
  }
};

/**
 * @param {string} event
 * @param {Record<string, unknown>} properties
 */
const keepAllowed = (event, properties) => {
  /** @type {Record<string, unknown>} */
  const kept = {};
  for (const key of allowedProperties(event)) {
    if (properties[key] !== undefined) kept[key] = properties[key];
  }
  return kept;
};

/**
 * Builds `{ event, distinct_id, properties }` from hook stdin, or returns null
 * when the input is not something the contract tracks.
 * @param {HookInput | null | undefined} input
 * @param {{ adapter: TelemetryAdapter, os: string, arcadeUsedBefore: boolean, cli?: string, appWork: boolean }} options
 *   `cli` is the hook command's `--cli` argument, set only on Bash entries.
 */
export const buildEvent = (input, { adapter, os, arcadeUsedBefore, cli, appWork }) => {
  if (!input || typeof input !== "object") return null;
  if (typeof input.session_id !== "string" || input.session_id === "") return null;
  const found = eventFor(input, adapter, cli, appWork);
  if (!found) return null;
  const [event, extra] = found;

  /** @type {Record<string, unknown>} */
  const properties = {
    ...extra,
    host: adapter.host,
    plugin_version: PLUGIN_VERSION,
    telemetry_version: 2,
    os: oneOf(os, OS_NAMES, "other"),
    $process_person_profile: false,
    $geoip_disable: true,
    // PostHog stores the request's IP unless the event sets one. Null and ""
    // are replaced; a fixed placeholder is kept.
    $ip: "0.0.0.0",
    arcade_used_before: arcadeUsedBefore === true,
  };
  const session = shortHash(input.session_id);
  properties.session = session;
  if (typeof input.prompt_id === "string") {
    properties.turn = shortHash(`${input.session_id}:${input.prompt_id}`);
  }

  return {
    event,
    distinct_id: session,
    properties: keepAllowed(event, properties),
  };
};

/**
 * True for a successful call to this plugin's Arcade gateway or another
 * Arcade connection.
 * @param {{ event: string, properties: Record<string, unknown> }} event
 */
export const isArcadeCall = ({ event, properties }) =>
  event === "Plugin tool called" && (properties.server === "arcade" || properties.server === "other_arcade");
