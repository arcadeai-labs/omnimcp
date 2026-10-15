// @ts-check

import {
  arcadeToolProperties,
  otherServerToolProperties,
} from "../telemetry-events.mjs";

/** @typedef {import("../telemetry-adapter.mjs").TelemetryAdapter} TelemetryAdapter */
/** @typedef {import("../telemetry-adapter.mjs").HookInput} HookInput */

export const COPILOT_ARCADE_SERVER = "arcade";

const pickString = (/** @type {unknown} */ value) =>
  typeof value === "string" && value !== "" ? value : undefined;

/**
 * @param {Record<string, any>} raw
 * @returns {HookInput}
 */
const normalize = (raw) => {
  /** @type {HookInput} */
  const input = {};
  const hook_event_name = pickString(raw.hook_event_name);
  if (hook_event_name) input.hook_event_name = hook_event_name;
  const session_id = pickString(raw.session_id);
  if (session_id) input.session_id = session_id;
  const prompt_id = pickString(raw.prompt_id);
  if (prompt_id) input.prompt_id = prompt_id;
  const source = pickString(raw.source);
  if (source) input.source = source;
  if (raw.prompt !== undefined) input.prompt = raw.prompt;
  const tool_name = pickString(raw.tool_name);
  if (tool_name) input.tool_name = tool_name;
  if (raw.tool_input !== undefined && raw.tool_input !== null && typeof raw.tool_input === "object") {
    input.tool_input = raw.tool_input;
  }
  if (
    raw.tool_result !== null &&
    typeof raw.tool_result === "object" &&
    typeof raw.tool_result.text_result_for_llm === "string"
  ) {
    input.tool_response = raw.tool_result.text_result_for_llm;
  }
  if (raw.error !== undefined) input.error = raw.error;
  if (raw.is_interrupt !== undefined) input.is_interrupt = raw.is_interrupt;
  const agent_type = pickString(raw.agent_type);
  if (agent_type) input.agent_type = agent_type;
  const agent_id = pickString(raw.agent_id);
  if (agent_id) input.agent_id = agent_id;
  if (raw.last_assistant_message !== undefined) input.last_assistant_message = raw.last_assistant_message;
  return input;
};

/**
 * @param {unknown} toolName
 * @param {Record<string, any> | undefined} toolInput
 */
const toolProperties = (toolName, toolInput) => {
  if (typeof toolName !== "string") return null;
  // Arcade tool names never contain "-", so the last one ends the server name.
  const splitAt = toolName.lastIndexOf("-");
  // Built-in tools (Bash, Agent) have no server prefix.
  if (splitAt <= 0 || splitAt === toolName.length - 1) return null;
  const server = toolName.slice(0, splitAt);
  const tool = toolName.slice(splitAt + 1);
  if (server === COPILOT_ARCADE_SERVER) {
    return arcadeToolProperties("arcade", tool, toolInput);
  }
  return otherServerToolProperties(server, tool, toolInput);
};

/** @type {TelemetryAdapter} */
const copilotCliAdapter = {
  host: "copilot-cli",
  dataVariable: "COPILOT_PLUGIN_DATA",
  // Copilot documents "true" and doesn't say which other values it
  // accepts, so any value that isn't clearly off counts.
  optOutSwitches: [{ name: "COPILOT_OFFLINE", anyValue: false }],
  requiresTurn: false,
  promptReminder: false,
  subagentSession: true,
  hookRows: [
    { event: "UserPromptSubmit" },
    { event: "PostToolUse", matcher: ".+-.+" },
    { event: "PostToolUseFailure", matcher: ".+-.+" },
    { event: "SubagentStop" },
  ],
  normalize,
  toolProperties,
};

export default copilotCliAdapter;
