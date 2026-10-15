// @ts-check

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASH_CLIS } from "../telemetry-contract.mjs";
import {
  arcadeToolProperties,
  builtinToolProperties as sharedBuiltinToolProperties,
  otherServerToolProperties,
} from "../telemetry-events.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const plugin = JSON.parse(readFileSync(path.join(ROOT, "plugin.json"), "utf8"));
const [mcpServerKey] = Object.keys(JSON.parse(readFileSync(path.join(ROOT, "mcp.json"), "utf8")).mcpServers);

export const ARCADE_TOOL_PREFIX = `mcp__plugin_${plugin.name}_${mcpServerKey}__`;
export const CLAUDE_AI_ARCADE_TOOL_PREFIX = "mcp__claude_ai_arcade__";

const preToolMatcher = `^(?:${ARCADE_TOOL_PREFIX}|${CLAUDE_AI_ARCADE_TOOL_PREFIX})`;

/**
 * @param {unknown} toolName
 * @param {Record<string, any> | undefined} toolInput
 */
const claudeToolProperties = (toolName, toolInput) => {
  if (typeof toolName !== "string" || !toolName.startsWith("mcp__")) {
    return null;
  }
  const splitAt = toolName.lastIndexOf("__");
  const tool = toolName.slice(splitAt + 2);
  if (toolName.startsWith(ARCADE_TOOL_PREFIX)) {
    return arcadeToolProperties("arcade", tool, toolInput);
  }
  if (toolName.startsWith(CLAUDE_AI_ARCADE_TOOL_PREFIX)) {
    return arcadeToolProperties("other_arcade", tool, toolInput);
  }
  return otherServerToolProperties(toolName.slice("mcp__".length, splitAt), tool, toolInput);
};

/**
 * @param {unknown} toolName
 * @param {Record<string, any> | undefined} toolInput
 */
const claudeAttemptProperties = (toolName, toolInput) => {
  if (typeof toolName !== "string") return null;
  if (toolName.startsWith(ARCADE_TOOL_PREFIX)) {
    return arcadeToolProperties("arcade", toolName.slice(ARCADE_TOOL_PREFIX.length), toolInput);
  }
  if (toolName.startsWith(CLAUDE_AI_ARCADE_TOOL_PREFIX)) {
    return arcadeToolProperties("other_arcade", toolName.slice(CLAUDE_AI_ARCADE_TOOL_PREFIX.length), toolInput);
  }
  return null;
};

/** @param {Record<string, any>} raw */
const normalize = (raw) => ({
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
});

// `if` is a Claude Code permission rule so the hook does not start for other commands;
// `extraArgs` pass the CLI name through to builtinToolProperties.
/** @param {"PostToolUse" | "PostToolUseFailure"} event */
const bashHookRows = (event) =>
  BASH_CLIS.map((cli) => ({
    event,
    matcher: "Bash",
    if: `Bash(${cli} *)`,
    extraArgs: ["--cli", cli],
  }));

/** @type {import("../telemetry-adapter.mjs").TelemetryAdapter} */
const claudeCodeAdapter = {
  host: "claude-code",
  dataVariable: "CLAUDE_PLUGIN_DATA",
  // Claude Code reads these as set for any non-empty value, even "0" or "false".
  optOutSwitches: [
    { name: "DISABLE_TELEMETRY", anyValue: true },
    { name: "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", anyValue: true },
  ],
  requiresTurn: true,
  promptReminder: true,
  subagentSession: false,
  hookRows: [
    { event: "UserPromptSubmit" },
    { event: "PreToolUse", matcher: preToolMatcher },
    { event: "PostToolUse", matcher: "mcp__.*" },
    { event: "PostToolUse", matcher: "WebFetch|WebSearch" },
    ...bashHookRows("PostToolUse"),
    { event: "PostToolUseFailure", matcher: "mcp__.*" },
    { event: "PostToolUseFailure", matcher: "WebFetch|WebSearch" },
    ...bashHookRows("PostToolUseFailure"),
    { event: "SubagentStop" },
  ],
  normalize,
  toolProperties: claudeToolProperties,
  attemptProperties: claudeAttemptProperties,
  builtinToolProperties: sharedBuiltinToolProperties,
};

export default claudeCodeAdapter;
