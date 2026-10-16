// @ts-check
/** Test-only telemetry adapter; not loaded by production hook-hosts.mjs. */

import { serviceForToolName } from "../../hooks/telemetry-classify.mjs";
import {
  arcadeToolProperties,
  builtinToolProperties,
  otherServerProperties,
} from "../../hooks/telemetry-events.mjs";

export const FAKE_ARCADE_PREFIX = "mcp__fake_arcade__";
export const FAKE_OTHER_PREFIX = "mcp__fake_other__";

/** @type {import("../../hooks/telemetry-adapter.mjs").TelemetryAdapter} */
const fakeAdapter = {
  host: "claude-code",
  dataVariable: "ARCADE_TEST_PLUGIN_DATA",
  optOutSwitches: [
    { name: "FAKE_DISABLE_TELEMETRY", anyValue: true },
    { name: "FAKE_OFFLINE", anyValue: false },
  ],
  requiresTurn: true,
  promptReminder: true,
  subagentSession: false,
  hookRows: [
    { event: "UserPromptSubmit" },
    { event: "PreToolUse", matcher: "mcp__fake_arcade__.*" },
    { event: "PostToolUse", matcher: "mcp__.*" },
    { event: "PostToolUseFailure", matcher: "mcp__.*" },
    { event: "PostToolUse", matcher: "WebFetch|WebSearch" },
    { event: "PostToolUseFailure", matcher: "WebFetch|WebSearch" },
    { event: "PostToolUse", matcher: "Bash", if: "Bash(gh *)", extraArgs: ["--cli", "gh"] },
    { event: "PostToolUseFailure", matcher: "Bash", if: "Bash(gh *)", extraArgs: ["--cli", "gh"] },
    { event: "SubagentStop" },
  ],
  normalize: (raw) => ({
    hook_event_name: raw.hook_event_name,
    session_id: raw.session_id,
    prompt_id: raw.prompt_id,
    source: raw.source,
    prompt: raw.prompt,
    tool_name: raw.tool_name,
    tool_input: raw.tool_input,
    tool_response: raw.tool_response,
    error: raw.error,
    is_interrupt: raw.is_interrupt,
    agent_type: raw.agent_type,
    agent_id: raw.agent_id,
    last_assistant_message: raw.last_assistant_message,
  }),
  toolProperties(toolName, toolInput) {
    if (typeof toolName !== "string") return null;
    if (toolName.startsWith(FAKE_ARCADE_PREFIX)) {
      return arcadeToolProperties("arcade", toolName.slice(FAKE_ARCADE_PREFIX.length), toolInput);
    }
    if (toolName.startsWith(FAKE_OTHER_PREFIX)) {
      const tool = toolName.slice(FAKE_OTHER_PREFIX.length);
      return otherServerProperties(serviceForToolName(tool));
    }
    return null;
  },
  attemptProperties(toolName, toolInput) {
    if (typeof toolName !== "string" || !toolName.startsWith(FAKE_ARCADE_PREFIX)) return null;
    return arcadeToolProperties("arcade", toolName.slice(FAKE_ARCADE_PREFIX.length), toolInput);
  },
  builtinToolProperties,
};

export default fakeAdapter;
