/**
 * The hooks this plugin runs and the clients that run them. `npm run generate`
 * writes each client's hooks.json from this table. Every hook command passes
 * `--host <name>` so the script prints the output format that client reads.
 */

import { loadTelemetryAdapter } from "./telemetry-adapter.mjs";
import { TELEMETRY_ENABLED } from "./telemetry-config.mjs";

export const HOOK_TIMEOUT_SEC = 5;

/**
 * Each client that runs plugin hooks. `runOnlyIfScriptExists` makes each
 * command check for its script first. `telemetry` names the client's adapter
 * in hooks/telemetry-adapters/ (see hooks/telemetry-adapter.mjs).
 */
export const HOSTS = {
  "claude-code": {
    // Not hooks/hooks.json: Cursor falls back to that default path and would
    // run these too.
    manifest: ".claude-plugin/hooks.json",
    format: "nested",
    rootVariable: "CLAUDE_PLUGIN_ROOT",
    telemetry: "claude-code",
    contextOutput: (eventName, text) => ({
      hookSpecificOutput: { hookEventName: eventName, additionalContext: text },
    }),
  },
  // Cursor's CLI doesn't load the plugin's always-apply rule, so the session
  // hook carries the full rules. The IDE and Cloud Agents don't run plugin
  // hooks, so they rely on the always-apply rule, which is the full session
  // rules. Cursor's prompt and subagent hooks can't add context.
  cursor: {
    manifest: "clients/cursor/hooks/hooks.json",
    format: "flat",
    rootVariable: "CURSOR_PLUGIN_ROOT",
    events: { SessionStart: "sessionStart" },
    contextOutput: (_eventName, text) => ({ additional_context: text }),
  },
  // Copilot CLI. PascalCase names put it in its VS Code-compatible mode
  // (snake_case SessionStart input; SubagentStart still sends camelCase
  // agentName in 1.0.88); it drops prompt-hook output, so it has no prompt
  // reminder hook. The other events it lists run only telemetry.
  // VS Code reads this file too but doesn't set or expand ${PLUGIN_ROOT} for
  // Agent Plugins hooks or pass their output to the model (pluginParsers.ts,
  // copilotPluginConverters.ts on microsoft/vscode main, 2026-09), so each
  // command checks that its script exists and otherwise exits 0 without output.
  copilot: {
    manifest: "com.github.copilot/hooks/hooks.json",
    format: "flat",
    rootVariable: "PLUGIN_ROOT",
    runOnlyIfScriptExists: true,
    telemetry: "copilot-cli",
    events: {
      SessionStart: "SessionStart",
      SubagentStart: "SubagentStart",
      UserPromptSubmit: "UserPromptSubmit",
      PostToolUse: "PostToolUse",
      PostToolUseFailure: "PostToolUseFailure",
      SubagentStop: "SubagentStop",
    },
    contextOutput: (eventName, text) => ({
      additionalContext: text,
      hookSpecificOutput: { hookEventName: eventName, additionalContext: text },
    }),
  },
};

/**
 * The telemetry hook entries of every client with a `telemetry` adapter,
 * whether or not telemetry is enabled. Tests use this to check the wiring.
 */
export const telemetryHookRows = async () => {
  const rows = [];
  for (const [hostName, host] of Object.entries(HOSTS)) {
    if (!host.telemetry) continue;
    const adapter = await loadTelemetryAdapter(host.telemetry);
    for (const row of adapter.hookRows) {
      rows.push({ script: "telemetry.mjs", ...row, hosts: [hostName] });
    }
  }
  return rows;
};

/**
 * One entry per hook command. The event is Claude Code's name for it; a client
 * with an `events` map uses its own names and only gets the events it lists.
 * `hosts` limits an entry to some clients. `matcher` picks the tools a tool
 * event runs for. `if` (a Claude Code permission rule such as "Bash(gh *)"
 * that keeps the hook from starting for other commands) and `extraArgs`
 * (added to the command) work only in the nested format.
 */
export const HOOKS = [
  { script: "session-start.mjs", event: "SessionStart" },
  // Copilot CLI drops prompt-hook output, so only Claude Code runs this one.
  { script: "user-prompt-submit.mjs", event: "UserPromptSubmit", hosts: ["claude-code"] },
  { script: "subagent-start.mjs", event: "SubagentStart" },
  // No telemetry hooks are written while telemetry is off (telemetry-config.mjs).
  ...(TELEMETRY_ENABLED ? await telemetryHookRows() : []),
];

/** The client named by `--host`, or null if it's missing or unknown. */
export const hostFromArgs = (argv) => {
  const flag = argv.indexOf("--host");
  return flag === -1 ? null : (HOSTS[argv[flag + 1]] ?? null);
};

/** The hook's JSON input, or {} if there is none or it doesn't parse. */
export const readInput = async () => {
  if (process.stdin.isTTY) return {};
  let data = "";
  try {
    for await (const chunk of process.stdin) data += chunk;
    return JSON.parse(data) ?? {};
  } catch {
    return {};
  }
};

/** Adds text to the model's context in the format `host` reads. */
export const printContext = (host, eventName, text) => {
  process.stdout.write(JSON.stringify(host.contextOutput(eventName, text)));
};
