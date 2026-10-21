// @ts-check

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { HOOKS, HOSTS, telemetryHookRows } from "../../hooks/hook-hosts.mjs";
import { SCOPE_DIRECTORY, SCOPE_TTL_MS } from "../../hooks/hook-scope.mjs";
import { ARCADE_USED_FILE } from "../../hooks/telemetry-config.mjs";
import { buildEvent, isArcadeCall } from "../../hooks/telemetry-events.mjs";
import { isOptedOut } from "../../hooks/telemetry-run.mjs";
import copilotAdapter, { COPILOT_ARCADE_SERVER } from "../../hooks/telemetry-adapters/copilot-cli.mjs";
import { buildHookManifest } from "../scripts/generate-manifests.mjs";
import {
  readRepoFile,
  ROOT,
  runPowerShell,
  skipOnWindows,
  skipWithoutPowerShell,
} from "./helpers.mjs";
import {
  assertMatchesContract,
  assertNoLeak,
  assertSilentThenServerReachable,
  captureTelemetry,
  expectedEvent,
  hash16,
  hookEnv,
  runTelemetryScript,
  startServer,
  tempDataDir,
} from "./telemetry-helpers.mjs";

const FIXTURE_DIR = path.join(ROOT, "dev/test/fixtures/telemetry/copilot-cli");
const SESSION_ID = "dd3beb80-4471-4513-99a4-a57d3d7c08df";
const SUBAGENT_ID = "57946be7-1a73-40ca-a042-abb0f68d9445";
const OPERATOR = "arcade:arcade-operator";
const MCP_TOOL_MATCHER = ".+-.+";

const copilotInput = (fields) => ({
  session_id: SESSION_ID,
  timestamp: "2026-09-24T21:27:02.743Z",
  cwd: "/Users/someone/private-repo",
  ...fields,
});

const fixtureFiles = () =>
  readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith(".json") && name !== "hooks.enabled.json")
    .sort();

const readFixture = (name) => JSON.parse(readFileSync(path.join(FIXTURE_DIR, name), "utf8"));

const resolveExpected = (fixture, input) => {
  if (fixture.expected === null) return null;
  const extra = { ...fixture.expected.extra };
  if (extra.subagent_session?.startsWith("$hash:")) {
    extra.subagent_session = hash16(extra.subagent_session.slice("$hash:".length));
  }
  if (extra.subagent_session === SUBAGENT_ID) {
    extra.subagent_session = hash16(SUBAGENT_ID);
  }
  const sessionId = input.session_id ?? SESSION_ID;
  const event = expectedEvent(fixture.expected.event, extra, copilotAdapter, sessionId, undefined);
  const os = /** @type {readonly string[]} */ (["darwin", "linux", "win32"]).includes(process.platform)
    ? process.platform
    : "other";
  event.properties.os = os;
  return event;
};

const runFixture = async (fixture, dataDir) => {
  for (const step of fixture.prelude ?? []) {
    await captureTelemetry({ adapter: copilotAdapter, input: step, dataDir });
  }
  return captureTelemetry({ adapter: copilotAdapter, input: fixture.input, dataDir });
};

// Classified as app work, so these hooks would send an event if the hard-OFF gate were open.
const SENDABLE_PROMPT = copilotInput({ hook_event_name: "UserPromptSubmit", prompt: "What is on my calendar tomorrow?" });

const assertNothingSent = (server, env) =>
  assertSilentThenServerReachable({ server, adapter: copilotAdapter, input: SENDABLE_PROMPT, env });

const enabledManifest = JSON.parse(readFileSync(path.join(FIXTURE_DIR, "hooks.enabled.json"), "utf8"));
const enabledTelemetryEntries = () =>
  Object.entries(enabledManifest.hooks).flatMap(([event, entries]) =>
    entries
      .filter((entry) => entry.command?.includes("telemetry.mjs"))
      .map((entry) => ({ event, ...entry })),
  );

for (const file of fixtureFiles()) {
  test(`fixture ${file} maps through captureTelemetry`, async () => {
    const fixture = readFixture(file);
    const dataDir = tempDataDir();
    const { sent } = await runFixture(fixture, dataDir);
    const want = resolveExpected(fixture, fixture.input);
    if (want === null) {
      assert.equal(sent.length, 0, file);
      return;
    }
    assert.equal(sent.length, 1, file);
    assert.deepEqual(sent[0], want, file);
    assertMatchesContract(sent[0], file);
    assertNoLeak(JSON.stringify(sent[0]), /private-repo|dd3beb80|57946be7|SECRET/i);
  });
}

test("Copilot-shaped hook input never carries turn and PreToolUse sends no attempt event", async () => {
  const dataDir = tempDataDir();
  await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({ hook_event_name: "UserPromptSubmit", prompt: "What is on my calendar tomorrow?" }),
    dataDir,
  });
  const { sent } = await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({
      hook_event_name: "PostToolUse",
      tool_name: "arcade-Gmail_ListEmails",
      tool_input: {},
      tool_result: { result_type: "success", text_result_for_llm: "[]" },
    }),
    dataDir,
  });
  assert.equal(sent[0].properties.turn, undefined);
  const attempt = await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({ hook_event_name: "PreToolUse", tool_name: "arcade-list_apps", tool_input: {} }),
    dataDir,
  });
  assert.equal(attempt.sent.length, 0);
  assert.ok(!attempt.sent.some((event) => event.event === "Plugin tool attempted"));
});

test("session scope follows Copilot prompts and tools in one data dir", async () => {
  const dataDir = tempDataDir();
  const baseNow = 1_700_000_000_000;
  await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({ hook_event_name: "UserPromptSubmit", prompt: "What is on my calendar tomorrow?" }),
    dataDir,
    now: baseNow,
  });
  const tool = await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({
      hook_event_name: "PostToolUse",
      tool_name: "arcade-Gmail_ListEmails",
      tool_input: {},
      tool_result: { result_type: "success", text_result_for_llm: "[]" },
    }),
    dataDir,
    now: baseNow + 1000,
  });
  assert.equal(tool.sent.length, 1);
  assert.equal(tool.sent[0].properties.turn, undefined);

  const unrelated = await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({ hook_event_name: "UserPromptSubmit", prompt: "Fix the parser in src/main.ts" }),
    dataDir,
    now: baseNow + 2000,
  });
  assert.equal(unrelated.sent.length, 0);
  const silentTool = await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({
      hook_event_name: "PostToolUse",
      tool_name: "granola-Granola_ListMeetings",
      tool_input: {},
      tool_result: { result_type: "success", text_result_for_llm: "[]" },
    }),
    dataDir,
    now: baseNow + 3000,
  });
  assert.equal(silentTool.sent.length, 0);

  await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({ hook_event_name: "UserPromptSubmit", prompt: "What is on my calendar tomorrow?" }),
    dataDir,
    now: baseNow + 4000,
  });
  const confirm = await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({ hook_event_name: "UserPromptSubmit", prompt: "ok" }),
    dataDir,
    now: baseNow + 5000,
  });
  assert.equal(confirm.sent.length, 1);
  const scopeFile = path.join(dataDir, SCOPE_DIRECTORY, readdirSync(path.join(dataDir, SCOPE_DIRECTORY))[0]);
  const expiresAt = JSON.parse(readFileSync(scopeFile, "utf8")).expiresAt;
  assert.ok(expiresAt <= baseNow + SCOPE_TTL_MS + 5000);

  await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({ hook_event_name: "SessionStart", source: "startup" }),
    dataDir,
    now: baseNow + 6000,
  });
  const afterStart = await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({
      hook_event_name: "PostToolUse",
      tool_name: "granola-Granola_ListMeetings",
      tool_input: {},
      tool_result: { result_type: "success", text_result_for_llm: "[]" },
    }),
    dataDir,
    now: baseNow + 7000,
  });
  assert.equal(afterStart.sent.length, 0);

  await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({ hook_event_name: "UserPromptSubmit", prompt: "What is on my calendar tomorrow?" }),
    dataDir,
    now: baseNow + 8000,
  });
  const expired = await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({
      hook_event_name: "PostToolUse",
      tool_name: "granola-Granola_ListMeetings",
      tool_input: {},
      tool_result: { result_type: "success", text_result_for_llm: "[]" },
    }),
    dataDir,
    now: baseNow + SCOPE_TTL_MS + 9000,
  });
  assert.equal(expired.sent.length, 0);
});

test("operator stop subagent_session matches the subagent session hash", async () => {
  const subagentPrompt = await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({
      hook_event_name: "UserPromptSubmit",
      session_id: SUBAGENT_ID,
      prompt: "Complete todo listing-arcade-apps",
    }),
  });
  const { sent } = await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({
      hook_event_name: "SubagentStop",
      agent_id: SUBAGENT_ID,
      agent_type: OPERATOR,
      last_assistant_message: "status: completed",
    }),
  });
  assert.equal(sent[0].properties.subagent_session, subagentPrompt.sent[0].properties.session);
});

test("arcade-used flag is stored in COPILOT_PLUGIN_DATA", async () => {
  const dataDir = tempDataDir();
  await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({
      hook_event_name: "UserPromptSubmit",
      prompt: "What is on my calendar tomorrow?",
    }),
    dataDir,
  });
  await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({
      hook_event_name: "PostToolUse",
      tool_name: "arcade-Gmail_ListEmails",
      tool_input: {},
      tool_result: { result_type: "success", text_result_for_llm: "private inbox" },
    }),
    dataDir,
  });
  assert.equal(readFileSync(path.join(dataDir, ARCADE_USED_FILE), "utf8"), "true");
  const second = await captureTelemetry({
    adapter: copilotAdapter,
    input: copilotInput({
      hook_event_name: "PostToolUse",
      tool_name: "arcade-Gmail_ListEmails",
      tool_input: {},
      tool_result: { result_type: "success", text_result_for_llm: "private inbox" },
    }),
    dataDir,
  });
  assert.equal(second.sent[0].properties.arcade_used_before, true);
  assert.equal(isArcadeCall(second.sent[0]), true);
});

test("opt-out and missing data dir send nothing", async () => {
  const input = copilotInput({
    hook_event_name: "PostToolUse",
    tool_name: "arcade-Gmail_ListEmails",
    tool_input: {},
    tool_result: { result_type: "success", text_result_for_llm: "[]" },
  });
  const cases = [
    ["ARCADE_PLUGIN_TELEMETRY=0", { ARCADE_PLUGIN_TELEMETRY: "0" }],
    ["DO_NOT_TRACK=1", { DO_NOT_TRACK: "1" }],
    ["COPILOT_OFFLINE=true", { COPILOT_OFFLINE: "true" }],
    ["COPILOT_OFFLINE=1", { COPILOT_OFFLINE: "1" }],
    ["no COPILOT_PLUGIN_DATA", { COPILOT_PLUGIN_DATA: "" }],
    ["relative COPILOT_PLUGIN_DATA", { COPILOT_PLUGIN_DATA: "relative/data" }],
  ];
  for (const [label, env] of cases) {
    const dataDir = tempDataDir();
    const { sent } = await captureTelemetry({ adapter: copilotAdapter, input, dataDir, env });
    assert.equal(sent.length, 0, label);
    assert.deepEqual(readdirSync(dataDir), [], label);
  }
  for (const extra of [{ COPILOT_OFFLINE: "false" }, { COPILOT_OFFLINE: "0" }, { DISABLE_TELEMETRY: "1" }]) {
    const dataDir = tempDataDir();
    await captureTelemetry({
      adapter: copilotAdapter,
      input: copilotInput({ hook_event_name: "UserPromptSubmit", prompt: "What is on my calendar tomorrow?" }),
      dataDir,
      env: extra,
    });
    const { sent } = await captureTelemetry({ adapter: copilotAdapter, input, dataDir, env: extra });
    assert.ok(sent.length > 0, JSON.stringify(extra));
  }
  assert.equal(isOptedOut(copilotAdapter.optOutSwitches, { COPILOT_OFFLINE: "true" }), true);
  assert.equal(isOptedOut(copilotAdapter.optOutSwitches, { COPILOT_OFFLINE: "false" }), false);
});

test("malformed hook input without a prompt sends nothing", async () => {
  const { sent } = await captureTelemetry({
    adapter: copilotAdapter,
    input: { session_id: SESSION_ID, hook_event_name: "UserPromptSubmit" },
  });
  assert.equal(sent.length, 0);
});

test("enabled Copilot manifest wiring matches hooks.enabled.json", async () => {
  const rows = [
    ...HOOKS.filter((hook) => hook.script !== "telemetry.mjs"),
    { script: "subagent-start.mjs", event: "SubagentStart" },
    ...(await telemetryHookRows()).filter((row) => row.hosts.includes("copilot")),
  ];
  const built = buildHookManifest("copilot", rows);
  assert.deepEqual(built, enabledManifest);
});

test("this release does not ship a Copilot hooks file", () => {
  assert.equal(existsSync(path.join(ROOT, HOSTS.copilot.manifest)), false);
});

test("enabled telemetry commands exit quietly while telemetry is off", skipOnWindows, async () => {
  const server = await startServer();
  const cwd = tempDataDir();
  const dataDir = tempDataDir();
  const captureEnv = { COPILOT_PLUGIN_DATA: dataDir, ARCADE_PLUGIN_TELEMETRY: "1", ARCADE_PLUGIN_TELEMETRY_HOST: server.url };
  try {
    for (const { command } of enabledTelemetryEntries()) {
      for (const extra of [{}, { PLUGIN_ROOT: ROOT }]) {
        const result = spawnSync(command, {
          shell: true,
          cwd,
          env: hookEnv({ ...extra, ...captureEnv }),
          input: JSON.stringify(SENDABLE_PROMPT),
          encoding: "utf8",
        });
        assert.equal(result.status, 0, command);
        assert.equal(result.stdout, "", command);
        assert.equal(result.stderr, "", command);
      }
    }
    await assertNothingSent(server, hookEnv(captureEnv));
    assert.deepEqual(readdirSync(dataDir), []);
  } finally {
    await server.close();
  }
});

test(
  "enabled telemetry powershell commands exit quietly while telemetry is off",
  skipWithoutPowerShell(),
  async () => {
    const server = await startServer();
    const cwd = tempDataDir();
    const dataDir = tempDataDir();
    try {
      const runPs = (script, env, input) =>
        runPowerShell(script, { cwd, env: hookEnv({ ARCADE_PLUGIN_TELEMETRY_HOST: server.url, ...env }), input });
      for (const { powershell } of enabledTelemetryEntries()) {
        assert.ok(powershell);
        const input = JSON.stringify(SENDABLE_PROMPT);
        const skipped = runPs(powershell, {}, input);
        assert.equal(skipped.status, 0);
        assert.equal(skipped.stdout, "");
        const ran = runPs(powershell, { PLUGIN_ROOT: ROOT, COPILOT_PLUGIN_DATA: dataDir }, input);
        assert.equal(ran.status, 0);
        assert.equal(ran.stdout, "");
      }
      await assertNothingSent(server, hookEnv({ ARCADE_PLUGIN_TELEMETRY_HOST: server.url }));
      assert.deepEqual(readdirSync(dataDir), []);
    } finally {
      await server.close();
    }
  },
);

test("the Copilot MCP tool matcher picks server tools, not built-ins", () => {
  const matcher = new RegExp(`^(?:${MCP_TOOL_MATCHER})$`);
  for (const name of ["arcade-Arcade_UseTool", "github-mcp-server-get_issue"]) assert.match(name, matcher);
  for (const name of ["Bash", "Agent", "view"]) assert.doesNotMatch(name, matcher);
});

test("normalize reads tool_result text_result_for_llm and ignores top-level tool_response", () => {
  const normalized = copilotAdapter.normalize({
    session_id: SESSION_ID,
    agent_type: OPERATOR,
    tool_name: "arcade-System_ManageAuthorization",
    tool_response: '{"providers":[{"status":"authorization_required"}]}',
    tool_result: { result_type: "success", text_result_for_llm: '{"providers":[]}' },
    transcript_path: "/SECRET/path",
    cwd: "/SECRET/cwd",
  });
  assert.equal(normalized.tool_response, '{"providers":[]}');
  assert.equal(normalized.prompt_id, undefined);
  assert.equal(normalized.session_id, SESSION_ID);
  const withPromptId = copilotAdapter.normalize({ session_id: SESSION_ID, prompt_id: "turn-1" });
  assert.equal(withPromptId.prompt_id, "turn-1");
  const built = buildEvent(
    { ...normalized, hook_event_name: "PostToolUse" },
    { adapter: copilotAdapter, os: "darwin", arcadeUsedBefore: false, appWork: true },
  );
  assert.equal(built?.properties.auth_needed, false);
  assertNoLeak(JSON.stringify(built), /SECRET/i);
});

test("normalize does not map SubagentStart camelCase fields into hook input", () => {
  const normalized = copilotAdapter.normalize({
    sessionId: SESSION_ID,
    agentName: OPERATOR,
    agentDisplayName: "arcade-operator",
  });
  assert.equal(normalized.session_id, undefined);
  assert.equal(normalized.agent_type, undefined);
});

test("Copilot CLI sends no built-in tool events", () => {
  const options = { adapter: copilotAdapter, os: "darwin", arcadeUsedBefore: false, appWork: true };
  assert.equal(
    buildEvent(copilotInput({ hook_event_name: "PostToolUse", tool_name: "WebFetch" }), options),
    null,
  );
  assert.equal(
    buildEvent(
      copilotInput({ hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "gh pr list" } }),
      { ...options, cli: "gh" },
    ),
    null,
  );
});

test("telemetry.mjs with --host copilot exits quietly while disabled", () => {
  const dataDir = tempDataDir();
  const result = runTelemetryScript(
    JSON.stringify(copilotInput({ hook_event_name: "PostToolUse", tool_name: "arcade-Gmail_ListEmails" })),
    { COPILOT_PLUGIN_DATA: dataDir, ARCADE_PLUGIN_TELEMETRY_HOST: "http://127.0.0.1:9" },
    "copilot",
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.deepEqual(readdirSync(dataDir), []);
});

test("arcade server prefix matches mcp.json", () => {
  const [server] = Object.keys(JSON.parse(readRepoFile("mcp.json")).mcpServers);
  assert.equal(COPILOT_ARCADE_SERVER, server);
});
