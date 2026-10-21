import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { HOSTS } from "../../hooks/hook-hosts.mjs";
import { shouldRemind } from "../../hooks/prompt-filters.mjs";
import {
  CURSOR_RULE,
  OPERATOR_RULES,
  PROMPT_REMINDER,
  SESSION_CONTEXT,
  SKILL_RULES,
  SUBAGENT_CONTEXT,
} from "../../hooks/routing-guidance.mjs";
import {
  readRepoFile,
  ROOT,
  runHook,
  runPowerShell,
  skipOnWindows,
  skipWithoutPowerShell,
} from "./helpers.mjs";
import { hookEnv, tempDataDir } from "./telemetry-helpers.mjs";

// This is a second copy of each client's hook output format, kept here on
// purpose so that changing a client's format in the hooks also requires
// changing this test. Each entry names its source.
const EXPECTED_OUTPUT = {
  // cursor.com/docs/hooks.md: sessionStart adds additional_context
  cursor: (_event, text) => ({ additional_context: text }),
  // code.claude.com/docs/en/hooks: hookSpecificOutput.additionalContext for SessionStart, UserPromptSubmit, SubagentStart
  "claude-code": (event, text) => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }),
  // measured in Copilot CLI 1.0.88: outputs both top-level additionalContext and hookSpecificOutput.additionalContext
  copilot: (event, text) => ({
    additionalContext: text,
    hookSpecificOutput: { hookEventName: event, additionalContext: text },
  }),
};

test("every client in the hook table has an expected output format", () => {
  assert.deepEqual(Object.keys(EXPECTED_OUTPUT).sort(), Object.keys(HOSTS).sort());
});

const HOOK_INPUT = JSON.stringify({ prompt: "What's on my calendar?", agent_type: "Explore" });

const assertPrintsContext = (hostName, event, result, label) => {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  const out = JSON.parse(result.stdout);
  const text = out.hookSpecificOutput?.additionalContext ?? out.additional_context;
  assert.ok(text, `${label}: no context in ${result.stdout}`);
  assert.deepEqual(out, EXPECTED_OUTPUT[hostName](event, text), label);
};

test("every command in every generated hooks.json runs and prints what its client reads", () => {
  for (const [hostName, { manifest, rootVariable }] of Object.entries(HOSTS)) {
    for (const [event, entries] of Object.entries(JSON.parse(readRepoFile(manifest)).hooks)) {
      for (const { command } of entries.flatMap((entry) => entry.hooks ?? [entry])) {
        // Telemetry prints nothing; the telemetry tests run its commands.
        if (command.includes("/hooks/telemetry.mjs")) continue;
        const result = spawnSync(command.replaceAll(`\${${rootVariable}}`, ROOT), {
          shell: true,
          input: HOOK_INPUT,
          encoding: "utf8",
        });
        assertPrintsContext(hostName, event, result, `${hostName} ${event}`);
      }
    }
  }
});

// Exercise the shared Copilot manifest's defensive script-existence guard.
// Missing/invalid roots are failure cases, not a simulation of VS Code.
// These subprocess checks do not launch a live Copilot CLI or VS Code session.
const copilotEntries = () =>
  Object.entries(JSON.parse(readRepoFile(HOSTS.copilot.manifest)).hooks).flatMap(([event, entries]) =>
    entries.map((entry) => ({ event, ...entry })),
  );

const VSCODE_INPUT = JSON.stringify({
  hook_event_name: "SessionStart",
  session_id: "vscode-session",
  cwd: "/workspace",
  prompt: "What's on my calendar?",
  agent_type: "Explore",
});

test("every Copilot hook command exits quietly with a missing or invalid plugin root", skipOnWindows, () => {
  const cwd = tempDataDir();
  for (const extra of [{}, { PLUGIN_ROOT: "/nonexistent" }]) {
    for (const { event, command } of copilotEntries()) {
      const label = `${event} ${command} ${JSON.stringify(extra)}`;
      const result = spawnSync(command, { shell: true, cwd, env: hookEnv(extra), input: VSCODE_INPUT, encoding: "utf8" });
      assert.equal(result.status, 0, `${label}: ${result.stderr}`);
      assert.equal(result.stdout, "", label);
      assert.equal(result.stderr, "", label);
    }
  }
});

/** Checks the output of a Copilot hook run with PLUGIN_ROOT set to the repo. */
const assertCopilotHookRan = (event, command, result, label) => {
  if (command.includes("/hooks/telemetry.mjs")) {
    assert.equal(result.status, 0, `${label}: ${result.stderr}`);
    assert.equal(result.stdout, "", label);
    return;
  }
  assertPrintsContext("copilot", event, result, label);
};

test("every Copilot hook command runs with PLUGIN_ROOT set only in the environment", skipOnWindows, () => {
  const cwd = tempDataDir();
  for (const { event, command } of copilotEntries()) {
    const result = spawnSync(command, { shell: true, cwd, env: hookEnv({ PLUGIN_ROOT: ROOT }), input: HOOK_INPUT, encoding: "utf8" });
    assertCopilotHookRan(event, command, result, `${event} ${command}`);
  }
});

test("every Copilot hook's powershell command skips without PLUGIN_ROOT and runs with it", skipWithoutPowerShell(), () => {
  const cwd = tempDataDir();
  const run = (script, env) => runPowerShell(script, { cwd, env, input: HOOK_INPUT });
  for (const { event, command, powershell } of copilotEntries()) {
    assert.ok(powershell, `${event} ${command}: no powershell command`);
    const skipped = run(powershell, hookEnv());
    assert.equal(skipped.status, 0, `${powershell}: ${skipped.stderr}`);
    assert.equal(skipped.stdout, "", powershell);
    assert.equal(skipped.stderr, "", powershell);
    assertCopilotHookRan(event, powershell, run(powershell, hookEnv({ PLUGIN_ROOT: ROOT })), powershell);
  }
});

test("shouldRemind skips acknowledgements and background task results", () => {
  for (const prompt of ["What's on my calendar?", "fix it", "go ahead and send it"]) {
    assert.equal(shouldRemind(prompt), true, prompt);
  }
  for (const prompt of ["", "ok", "yes thanks", "<task-notification>\n<task-id>a</task-id>", undefined]) {
    assert.equal(shouldRemind(prompt), false, String(prompt));
  }
});

test("subagent-start skips arcade-operator in every client's input format", () => {
  for (const input of [
    { agent_type: "arcade-operator" },
    { agent_type: "arcade:arcade-operator" },
    // Copilot CLI 1.0.88's SubagentStart input.
    { agentName: "arcade:arcade-operator", agentDisplayName: "arcade-operator" },
  ]) {
    const result = runHook("subagent-start.mjs", input, ["--host", "copilot"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "", `copilot ${JSON.stringify(input)}`);
  }
  assert.notEqual(runHook("subagent-start.mjs", { agentName: "general-purpose" }, ["--host", "copilot"]).stdout, "");
});

test("hooks exit 0 and print nothing without a known --host", () => {
  for (const script of ["session-start.mjs", "subagent-start.mjs"]) {
    for (const args of [[], ["--host", "nope"]]) {
      const result = runHook(script, { prompt: "What's on my calendar?" }, args);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "", `${script} ${args.join(" ")}`);
    }
  }
});

// Which hooks each client runs. Change this only with new evidence from the
// client. Each entry names its source.
const EXPECTED_EVENTS = {
  "claude-code": ["SessionStart"],
  // cursor.com/docs/hooks.md: sessionStart adds additional_context; beforeSubmitPrompt and subagentStart can't add context.
  // The CLI doesn't load the plugin's always-apply rule, so the session hook is the only way it gets the full rules.
  cursor: ["sessionStart"],
  // measured in Copilot CLI 1.0.88: SubagentStart runs and injects context; prompt hook output from config files is dropped
  // docs.github.com/en/copilot/reference/hooks-reference: SubagentStart input uses agentName
  copilot: ["SessionStart", "SubagentStart"],
};

test("each client runs exactly the hooks it can use", () => {
  assert.deepEqual(Object.keys(EXPECTED_EVENTS).sort(), Object.keys(HOSTS).sort());
  for (const [hostName, { manifest }] of Object.entries(HOSTS)) {
    const events = Object.keys(JSON.parse(readRepoFile(manifest)).hooks);
    assert.deepEqual(events.sort(), [...EXPECTED_EVENTS[hostName]].sort(), hostName);
  }
});

// Each client gets its routing rules from one of these texts, and some get
// only one: Cowork's main conversation gets only the per-prompt reminder and the skill, and
// the Cursor IDE gets only the rule and the skill. Keep the core rules in each.
const DELEGATE_SCOPE = [
  /Use Arcade gateways for delegated work/,
  /Do not substitute non-Arcade MCP servers, CLIs, built-in search, or direct APIs/,
  /Return unfinished work to the parent/,
  /another already-authorized Arcade gateway within the delegated task/,
  /name the source account for reads\. If you can't, return needs_confirmation\./,
  /For permission denial, return failed with the actual error/,
];

const FALLBACK_RULES = [
  /If the arcade server cannot finish,/,
  /confirm the intended app account with the app's who-am-I tool/,
  /Write only through a confirmed account, and name the source account for reads\./,
  /Discover tools on each gateway; never reuse another gateway's query IDs/,
  /Do not broaden authorization or copy secrets, credentials, or user sessions/,
  /Do not bypass either by switching gateways or tools/,
  /checking plugin and MCP settings for setup or connection failures, then apply fallback/,
];

const PARENT_FALLBACK_RULES = [
  /another already-authorized Arcade gateway or other available tools within the authorized task/,
  /name the source account for reads\. If you can't, ask the user\./,
  /For permission denial, stop and ask the user to resolve it/,
];

const CORE_RULES = {
  PROMPT_REMINDER: [PROMPT_REMINDER, [/"arcade" MCP server/, /try-arcade/, /arcade-operator/, /arcade server cannot complete/]],
  CURSOR_RULE: [CURSOR_RULE, [/"arcade" MCP server/, /api\.arcade\.dev/, /try-arcade/, /scale-arcade/, /arcade-operator/, /stop and ask the user to authenticate/, /needsAuth/, /Keep tool discovery/, /plugin-arcade-arcade/, ...FALLBACK_RULES, ...PARENT_FALLBACK_RULES]],
  SESSION_CONTEXT: [SESSION_CONTEXT, [/"arcade" MCP server/, /api\.arcade\.dev/, /try-arcade/, /scale-arcade/, /arcade-operator/, /stop and ask the user to authenticate/, /needsAuth/, /Keep tool discovery/, ...FALLBACK_RULES, ...PARENT_FALLBACK_RULES]],
  SKILL_RULES: [SKILL_RULES, [/"arcade" MCP server/, /api\.arcade\.dev/, /Prefer arcade/, /stop and ask the user to authenticate/, /needsAuth/, ...FALLBACK_RULES, ...PARENT_FALLBACK_RULES]],
  OPERATOR_RULES: [OPERATOR_RULES, [/"arcade" MCP server/, /api\.arcade\.dev/, /Prefer arcade/, /return needs_auth/, /return failed/, /needsAuth/, ...FALLBACK_RULES, ...DELEGATE_SCOPE]],
  SUBAGENT_CONTEXT: [SUBAGENT_CONTEXT, [/"arcade" MCP server/, /api\.arcade\.dev/, /Prefer arcade/, /try-arcade/, /return needs_auth/, /needsAuth/, /Keep tool discovery/, ...FALLBACK_RULES, ...DELEGATE_SCOPE]],
};

// The parent conversation tries Arcade first but may finish with other tools.
// BANS_OTHER_TOOLS matches exact phrases, so a reworded ban would pass.
const PARENT_LABELS = new Set(["PROMPT_REMINDER", "CURSOR_RULE", "SESSION_CONTEXT", "SKILL_RULES"]);
const BANS_OTHER_TOOLS = /gh or curl|don't move any part|explicitly chooses|MCP server only|use only arcade/;

test("every routing text keeps the core routing rules", () => {
  const shippedRules = {
    "clients/cursor/rules/arcade.mdc": CORE_RULES.CURSOR_RULE[1],
    "skills/try-arcade/SKILL.md": CORE_RULES.SKILL_RULES[1],
    "agents/arcade-operator.agent.md": CORE_RULES.OPERATOR_RULES[1],
    "com.github.copilot/agents/arcade-operator.agent.md": CORE_RULES.OPERATOR_RULES[1],
  };
  const texts = {
    ...CORE_RULES,
    ...Object.fromEntries(Object.entries(shippedRules).map(([path, phrases]) => [path, [readRepoFile(path), phrases]])),
  };
  for (const [label, [text, phrases]] of Object.entries(texts)) {
    for (const phrase of phrases) {
      assert.match(text.replace(/\s+/g, " "), phrase, label);
    }
    if (PARENT_LABELS.has(label)) {
      assert.doesNotMatch(text, BANS_OTHER_TOOLS, label);
    }
  }
  // Subagents can't start arcade-operator, so their text must not send them to it.
  assert.doesNotMatch(SUBAGENT_CONTEXT, /arcade-operator/);
  // Delegates report back to a parent; they don't offer the user another path.
  assert.doesNotMatch(OPERATOR_RULES, /explicitly chooses/);
  assert.doesNotMatch(SUBAGENT_CONTEXT, /explicitly chooses/);
});
