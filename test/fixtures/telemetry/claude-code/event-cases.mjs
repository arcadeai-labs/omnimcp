import {
  ARCADE_TOOL_PREFIX,
  CLAUDE_AI_ARCADE_TOOL_PREFIX,
} from "../../../../hooks/telemetry-adapters/claude-code.mjs";
import { authStatusResponse } from "./auth-status-response.mjs";

const SIGN_IN = `${ARCADE_TOOL_PREFIX}System_ManageAuthorization`;
const OPERATOR = "arcade:arcade-operator";

const tool = (name, toolInput) => ({ hook_event_name: "PostToolUse", tool_name: name, tool_input: toolInput });
const failed = (name, error, fields = {}) => ({
  hook_event_name: "PostToolUseFailure",
  tool_name: name,
  error,
  ...fields,
});
const signInCheck = (name, statuses) => ({
  hook_event_name: "PostToolUse",
  tool_name: name,
  tool_response: authStatusResponse(statuses),
});
const stop = (message) => ({
  hook_event_name: "SubagentStop",
  agent_type: OPERATOR,
  last_assistant_message: message,
});
const operator = (status) => ({ agent: "arcade-operator", status });

/**
 * @typedef {object} EventCase
 * @property {string} id
 * @property {Record<string, unknown>} input
 * @property {null | { event: string, extra: Record<string, unknown> }} expected
 * @property {string[]} [argv]
 * @property {boolean} [seedAppWork]
 */

/** @returns {EventCase[]} */
export const eventCases = () => {
  const ATTEMPTED = "Plugin tool attempted";
  const CALLED = "Plugin tool called";
  const FAILED = "Plugin tool failed";
  const STOPPED = "Plugin subagent stopped";
  /** @type {EventCase[]} */
  const cases = [
    { id: "session-start-startup", input: { hook_event_name: "SessionStart", source: "startup" }, expected: null },
    { id: "prompt-app-work", input: { hook_event_name: "UserPromptSubmit", prompt: "What is on my calendar tomorrow?" },
      expected: { event: "Plugin prompt submitted", extra: { could_use_arcade: true, service_hints: ["calendar"], reminder_sent: true } } },
    { id: "prompt-confirmation-style", input: { hook_event_name: "UserPromptSubmit", prompt: "ok", prompt_id: "confirm-turn" },
      expected: { event: "Plugin prompt submitted", extra: { could_use_arcade: false, service_hints: [], reminder_sent: false } },
      seedAppWork: true },
    { id: "prompt-unrelated", input: { hook_event_name: "UserPromptSubmit", prompt: "Fix the parser" }, expected: null },
    { id: "prompt-task-notification", input: {
      hook_event_name: "UserPromptSubmit",
      prompt: "<task-notification>\n<status>completed</status> calendar",
    }, expected: null },
    { id: "pre-arcade-select", input: { hook_event_name: "PreToolUse", tool_name: `${ARCADE_TOOL_PREFIX}Arcade_SelectTools` },
      expected: { event: ATTEMPTED, extra: { server: "arcade", tool: "Arcade_SelectTools" } } },
    { id: "pre-claude-ai-select", input: { hook_event_name: "PreToolUse", tool_name: `${CLAUDE_AI_ARCADE_TOOL_PREFIX}Arcade_SelectTools` },
      expected: { event: ATTEMPTED, extra: { server: "other_arcade", tool: "Arcade_SelectTools" } } },
    { id: "pre-claude-ai-calendar", input: { hook_event_name: "PreToolUse", tool_name: `${CLAUDE_AI_ARCADE_TOOL_PREFIX}GoogleCalendar_ListEvents` },
      expected: { event: ATTEMPTED, extra: { server: "other_arcade", tool: "app_tool", service: "calendar" } } },
    { id: "pre-use-tool", input: {
      hook_event_name: "PreToolUse",
      tool_name: `${ARCADE_TOOL_PREFIX}Arcade_UseTool`,
      tool_input: { tool_name: "GoogleCalendar.ListEvents" },
    }, expected: { event: ATTEMPTED, extra: { server: "arcade", tool: "Arcade_UseTool", service: "calendar" } } },
    { id: "pre-other-arcade-tool", input: { hook_event_name: "PreToolUse", tool_name: `${CLAUDE_AI_ARCADE_TOOL_PREFIX}AcmeHR_RunPayroll` },
      expected: { event: ATTEMPTED, extra: { server: "other_arcade", tool: "other" } } },
    { id: "pre-gmail-connector", input: { hook_event_name: "PreToolUse", tool_name: "mcp__claude_ai_Gmail__search_threads" }, expected: null },
    { id: "pre-wrong-arcade-connector", input: { hook_event_name: "PreToolUse", tool_name: "mcp__claude_ai_Arcade__Arcade_SelectTools" }, expected: null },
    { id: "post-gmail", input: tool(`${ARCADE_TOOL_PREFIX}Gmail_ListEmails`),
      expected: { event: CALLED, extra: { server: "arcade", tool: "app_tool", service: "email" } } },
    { id: "post-claude-ai-calendar", input: tool(`${CLAUDE_AI_ARCADE_TOOL_PREFIX}GoogleCalendar_ListEvents`),
      expected: { event: CALLED, extra: { server: "other_arcade", tool: "app_tool", service: "calendar" } } },
    { id: "post-sign-in-no-auth", input: tool(SIGN_IN),
      expected: { event: CALLED, extra: { server: "arcade", tool: "System_ManageAuthorization", auth_needed: false } } },
    { id: "post-sign-in-auth-needed", input: signInCheck(SIGN_IN, ["authorized", "authorization_required"]),
      expected: { event: CALLED, extra: { server: "arcade", tool: "System_ManageAuthorization", auth_needed: true } } },
    { id: "post-sign-in-authorized", input: signInCheck(SIGN_IN, ["authorized"]),
      expected: { event: CALLED, extra: { server: "arcade", tool: "System_ManageAuthorization", auth_needed: false } } },
    { id: "post-claude-ai-sign-in", input: signInCheck("mcp__claude_ai_Arcade__System_ManageAuthorization", ["authorization_required"]),
      expected: { event: CALLED, extra: { server: "other_arcade", tool: "System_ManageAuthorization", auth_needed: true } } },
    { id: "post-use-tool-gmail", input: tool(`${ARCADE_TOOL_PREFIX}Arcade_UseTool`, { tool_name: "Gmail.ListEmails" }),
      expected: { event: CALLED, extra: { server: "arcade", tool: "Arcade_UseTool", service: "email" } } },
    { id: "post-use-tool-calendar", input: tool(`${ARCADE_TOOL_PREFIX}Arcade_UseTool`, { tool_name: "GoogleCalendar.ListEvents" }),
      expected: { event: CALLED, extra: { server: "arcade", tool: "Arcade_UseTool", service: "calendar" } } },
    { id: "post-use-tool-unknown", input: tool(`${ARCADE_TOOL_PREFIX}Arcade_UseTool`, { tool_name: "AcmeHR.RunPayroll" }),
      expected: { event: CALLED, extra: { server: "arcade", tool: "Arcade_UseTool" } } },
    { id: "post-other-arcade-app", input: tool(`${ARCADE_TOOL_PREFIX}AcmeHR_RunPayroll`),
      expected: { event: CALLED, extra: { server: "arcade", tool: "other" } } },
    { id: "post-claude-ai-use-tool", input: tool("mcp__claude_ai_Arcade_Production__Arcade_UseTool", { tool_name: "Slack_SendMessage" }),
      expected: { event: CALLED, extra: { server: "other_arcade", tool: "Arcade_UseTool", service: "chat" } } },
    { id: "post-other-server-granola", input: tool("mcp__granola__Granola_ListMeetings"),
      expected: { event: CALLED, extra: { server: "other", service: "meetings" } }, seedAppWork: true },
    { id: "post-gmail-connector", input: tool("mcp__claude_ai_Gmail__search_threads"),
      expected: { event: CALLED, extra: { server: "other", service: "email" } }, seedAppWork: true },
    { id: "post-other-server-unknown", input: tool("mcp__secret-server__DoThing"),
      expected: { event: CALLED, extra: { server: "other" } }, seedAppWork: true },
    { id: "post-read-builtin", input: tool("Read"), expected: null },
    { id: "failure-slack", input: { hook_event_name: "PostToolUseFailure", tool_name: `${ARCADE_TOOL_PREFIX}Slack_SendMessage` },
      expected: { event: FAILED, extra: { server: "arcade", tool: "app_tool", service: "chat", failure_kind: "tool_error" } } },
    { id: "failure-auth", input: failed(`${ARCADE_TOOL_PREFIX}Gmail_ListEmails`,
      '{"message":"The tool was not executed because it requires authorization.","authorization_url":"https://example.com/auth"}'),
      expected: { event: FAILED, extra: { server: "arcade", tool: "app_tool", service: "email", failure_kind: "auth_required" } } },
    { id: "failure-session-expired", input: failed(`${ARCADE_TOOL_PREFIX}Arcade_UseTool`, 'MCP server "plugin:arcade:arcade" session expired',
      { tool_input: { tool_name: "Gmail.ListEmails" } }),
      expected: { event: FAILED, extra: { server: "arcade", tool: "Arcade_UseTool", service: "email", failure_kind: "session_expired" } } },
    { id: "failure-unreachable", input: failed(`${ARCADE_TOOL_PREFIX}Gmail_ListEmails`, "Connection closed"),
      expected: { event: FAILED, extra: { server: "arcade", tool: "app_tool", service: "email", failure_kind: "unreachable" } } },
    { id: "failure-interrupted", input: failed(`${ARCADE_TOOL_PREFIX}Gmail_ListEmails`, "Connection closed", { is_interrupt: true }),
      expected: { event: FAILED, extra: { server: "arcade", tool: "app_tool", service: "email", failure_kind: "interrupted" } } },
    { id: "failure-other-http", input: failed("mcp__secret-server__DoThing", "Error POSTing to endpoint: internal error"),
      expected: { event: FAILED, extra: { server: "other", failure_kind: "http_error" } }, seedAppWork: true },
    { id: "failure-read", input: failed("Read", "File does not exist."), expected: null },
    { id: "subagent-operator-needs-auth", input: stop("Done.\n\nstatus: needs_auth\nsummary: sign in"),
      expected: { event: STOPPED, extra: operator("needs_auth") } },
    { id: "subagent-operator-needs-confirmation", input: stop("**status:** needs_confirmation"),
      expected: { event: STOPPED, extra: operator("needs_confirmation") } },
    { id: "subagent-operator-needs-clarification", input: stop("- status: `needs_clarification`"),
      expected: { event: STOPPED, extra: operator("needs_clarification") } },
    { id: "subagent-operator-failed", input: stop("STATUS: FAILED"),
      expected: { event: STOPPED, extra: operator("failed") } },
    { id: "subagent-operator-unknown", input: stop("status: exploded"),
      expected: { event: STOPPED, extra: operator("unknown") } },
    { id: "subagent-operator-no-message", input: stop(undefined),
      expected: { event: STOPPED, extra: operator("unknown") } },
    { id: "subagent-non-operator", input: {
      hook_event_name: "SubagentStop",
      agent_type: "general-purpose",
      last_assistant_message: "status: completed",
    }, expected: null },
    { id: "subagent-operator-completed", input: {
      hook_event_name: "SubagentStop",
      agent_type: OPERATOR,
      agent_id: "agent-1",
      last_assistant_message: "status: completed",
    }, expected: { event: STOPPED, extra: operator("completed") } },
    { id: "builtin-webfetch", input: { hook_event_name: "PostToolUse", tool_name: "WebFetch", tool_input: { url: "https://example.com" } },
      expected: { event: "Plugin built-in tool called", extra: { tool: "WebFetch" } }, seedAppWork: true },
    { id: "builtin-websearch", input: { hook_event_name: "PostToolUse", tool_name: "WebSearch", tool_input: { query: "weather" } },
      expected: { event: "Plugin built-in tool called", extra: { tool: "WebSearch" } }, seedAppWork: true },
    { id: "builtin-bash-gh", input: { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "gh pr list" } },
      expected: { event: "Plugin built-in tool called", extra: { tool: "Bash", cli: "gh", service: "code_hosting" } },
      argv: ["--cli", "gh"], seedAppWork: true },
    { id: "builtin-bash-curl", input: { hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: { command: "curl x" } },
      expected: { event: "Plugin built-in tool failed", extra: { tool: "Bash", cli: "curl" } },
      argv: ["--cli", "curl"], seedAppWork: true },
    { id: "builtin-bash-non-listed", input: { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "echo hi" } },
      expected: null, argv: ["--cli", "gh"], seedAppWork: true },
    { id: "session-start-compact", input: { hook_event_name: "SessionStart", source: "compact" }, expected: null },
  ];
  return cases;
};
