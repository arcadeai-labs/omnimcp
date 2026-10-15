import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { BASH_CLIS } from "../hooks/telemetry-contract.mjs";
import { HOOKS, HOSTS, telemetryHookRows } from "../hooks/hook-hosts.mjs";
import { SCOPE_TTL_MS } from "../hooks/hook-scope.mjs";
import { buildEvent, isArcadeCall } from "../hooks/telemetry-events.mjs";
import adapter, {
  ARCADE_TOOL_PREFIX,
  CLAUDE_AI_ARCADE_TOOL_PREFIX,
} from "../hooks/telemetry-adapters/claude-code.mjs";
import { buildHookManifest } from "../scripts/generate-manifests.mjs";
import { readRepoFile, ROOT } from "./helpers.mjs";
import { eventCases } from "./fixtures/telemetry/claude-code/event-cases.mjs";
import {
  assertMatchesContract,
  assertNoLeak,
  assertSilentThenServerReachable,
  captureTelemetry,
  expectedEvent,
  hookEnv,
  hookInput,
  runTelemetryScript,
  startServer,
  telemetryEnv,
  tempDataDir,
} from "./telemetry-helpers.mjs";

const OPERATOR = "arcade:arcade-operator";
const SESSION_ID = "raw-session-id-123";
const PROMPT_ID = "raw-prompt-id-456";
const LEAK_RE = /SECRET|private-repo|raw-session|raw-prompt|authorization_url|example\.com/i;

const seedAppWork = async (dataDir, promptId = PROMPT_ID, now) => {
  await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({
      hook_event_name: "UserPromptSubmit",
      prompt: "Check my calendar",
      prompt_id: promptId,
    }),
  });
};

test("Arcade tool prefixes match plugin.json and mcp.json", () => {
  const plugin = JSON.parse(readRepoFile("plugin.json"));
  const [server] = Object.keys(JSON.parse(readRepoFile("mcp.json")).mcpServers);
  assert.equal(ARCADE_TOOL_PREFIX, `mcp__plugin_${plugin.name}_${server}__`);
  assert.equal(CLAUDE_AI_ARCADE_TOOL_PREFIX, "mcp__claude_ai_arcade__");
});

test("every fixture maps through captureTelemetry to the expected contract event", async () => {
  for (const { id, input, expected, argv = [], seedAppWork: seed } of eventCases()) {
    const dataDir = tempDataDir();
    if (seed) await seedAppWork(dataDir, PROMPT_ID);
    const { sent } = await captureTelemetry({ adapter, dataDir, input: hookInput(input), argv });
    if (expected === null) {
      assert.equal(sent.length, 0, id);
      continue;
    }
    assert.equal(sent.length, 1, id);
    const promptId = typeof input.prompt_id === "string" ? input.prompt_id : PROMPT_ID;
    const want = expectedEvent(expected.event, expected.extra, adapter, SESSION_ID, promptId);
    want.properties.os = process.platform;
    assert.deepEqual(sent[0], want, id);
    assertMatchesContract(sent[0], id);
    assertNoLeak(JSON.stringify(sent[0]), LEAK_RE);
  }
});

test("scope transitions across a sequence sharing one data dir", async () => {
  const dataDir = tempDataDir();
  const now = 1_000_000;
  const calendar = "calendar-turn";
  const unrelated = "unrelated-turn";
  const confirm = "confirm-turn";

  let r = await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({ hook_event_name: "UserPromptSubmit", prompt: "Fix the parser", prompt_id: unrelated }),
  });
  assert.equal(r.sent.length, 0);
  r = await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: "WebFetch", prompt_id: unrelated }),
  });
  assert.equal(r.sent.length, 0);

  await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({ hook_event_name: "UserPromptSubmit", prompt: "Check my calendar", prompt_id: calendar }),
  });
  r = await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: "WebFetch", prompt_id: calendar }),
  });
  assert.equal(r.sent.length, 1);

  r = await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: "WebFetch", prompt_id: "other-turn" }),
  });
  assert.equal(r.sent.length, 0);

  await captureTelemetry({
    adapter,
    dataDir,
    now: now + 1000,
    input: hookInput({ hook_event_name: "UserPromptSubmit", prompt: "yes, send it", prompt_id: confirm }),
  });
  r = await captureTelemetry({
    adapter,
    dataDir,
    now: now + 1000,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: "WebFetch", prompt_id: confirm }),
  });
  assert.equal(r.sent.length, 1);

  await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({ hook_event_name: "UserPromptSubmit", prompt: "Check my calendar", prompt_id: calendar }),
  });
  await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({ hook_event_name: "SessionStart", source: "compact", session_id: SESSION_ID }),
  });
  r = await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: "WebFetch", prompt_id: calendar }),
  });
  assert.equal(r.sent.length, 1, "compact SessionStart keeps scope");

  await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({ hook_event_name: "UserPromptSubmit", prompt: "Check my calendar", prompt_id: "after-compact" }),
  });
  await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({ hook_event_name: "SessionStart", source: "startup", session_id: SESSION_ID }),
  });
  r = await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: "WebFetch", prompt_id: calendar }),
  });
  assert.equal(r.sent.length, 0, "normal SessionStart clears scope");

  const expTurn = "expiry-turn";
  await captureTelemetry({
    adapter,
    dataDir,
    now,
    input: hookInput({ hook_event_name: "UserPromptSubmit", prompt: "Check my calendar", prompt_id: expTurn }),
  });
  r = await captureTelemetry({
    adapter,
    dataDir,
    now: now + SCOPE_TTL_MS + 1,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: "WebFetch", prompt_id: expTurn }),
  });
  assert.equal(r.sent.length, 0, "scope expires after 30 minutes");
});

test("direct Arcade calls are observed without prompt scope; other and built-in tools need scope", async () => {
  const fresh = tempDataDir();
  const arcade = await captureTelemetry({
    adapter,
    dataDir: fresh,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: `${ARCADE_TOOL_PREFIX}Gmail_ListEmails` }),
  });
  assert.equal(arcade.sent.length, 1);

  const scoped = tempDataDir();
  const other = await captureTelemetry({
    adapter,
    dataDir: scoped,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: "mcp__granola__Granola_ListMeetings" }),
  });
  assert.equal(other.sent.length, 0);
  await seedAppWork(scoped);
  const otherInScope = await captureTelemetry({
    adapter,
    dataDir: scoped,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: "mcp__granola__Granola_ListMeetings" }),
  });
  assert.equal(otherInScope.sent.length, 1);

  const builtinDir = tempDataDir();
  const builtin = await captureTelemetry({
    adapter,
    dataDir: builtinDir,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: "WebFetch" }),
  });
  assert.equal(builtin.sent.length, 0);
});

test("arcade-used is set only by a successful Arcade gateway call", async () => {
  const dataDir = tempDataDir();
  const other = await captureTelemetry({
    adapter,
    dataDir,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: "mcp__granola__Granola_ListMeetings" }),
  });
  assert.deepEqual(readdirSync(dataDir), []);
  const attempt = await captureTelemetry({
    adapter,
    dataDir,
    input: hookInput({
      hook_event_name: "PreToolUse",
      tool_name: `${CLAUDE_AI_ARCADE_TOOL_PREFIX}GoogleCalendar_ListEvents`,
      tool_input: { query: "SECRET private meeting" },
    }),
  });
  assert.deepEqual(readdirSync(dataDir), []);
  const arcade = await captureTelemetry({
    adapter,
    dataDir,
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: `${ARCADE_TOOL_PREFIX}Gmail_ListEmails` }),
  });
  assert.equal(readFileSync(path.join(dataDir, "arcade-used"), "utf8"), "true");
  if (process.platform !== "win32") {
    assert.equal(statSync(path.join(dataDir, "arcade-used")).mode & 0o777, 0o600);
  }
  assert.equal(other.sent.length, 0);
  assert.equal(attempt.sent.length, 1);
  assert.equal(attempt.sent[0].event, "Plugin tool attempted");
  assertNoLeak(JSON.stringify(attempt.sent[0]), /SECRET|private meeting/);
  assert.equal(arcade.sent.length, 1);
  assert.deepEqual([attempt.sent[0], arcade.sent[0]].map((e) => e.properties.arcade_used_before), [false, false]);
});

test("Claude opt-out switches send nothing and write no data dir files", async () => {
  const base = hookInput({ hook_event_name: "UserPromptSubmit", prompt: "Check my calendar" });
  const sessionStart = hookInput({ hook_event_name: "SessionStart", source: "startup" });
  const cases = [
    ["DISABLE_TELEMETRY=1", { DISABLE_TELEMETRY: "1" }],
    ["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1", { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" }],
    ["DISABLE_TELEMETRY=0", { DISABLE_TELEMETRY: "0" }],
    ["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=false", { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "false" }],
    ["ARCADE_PLUGIN_TELEMETRY=0", { ARCADE_PLUGIN_TELEMETRY: "0" }],
    ["DO_NOT_TRACK=1", { DO_NOT_TRACK: "1" }],
    ["missing CLAUDE_PLUGIN_DATA", { CLAUDE_PLUGIN_DATA: "" }],
    ["relative CLAUDE_PLUGIN_DATA", { CLAUDE_PLUGIN_DATA: "relative/data" }],
  ];
  for (const [label, env] of cases) {
    const dataDir = tempDataDir();
    for (const input of [sessionStart, base]) {
      const { sent } = await captureTelemetry({ adapter, input, dataDir, env });
      assert.deepEqual(sent, [], label);
    }
    assert.deepEqual(readdirSync(dataDir), [], label);
  }
  const control = await captureTelemetry({ adapter, input: base });
  assert.equal(control.sent.length, 1, "the same prompt sends without an opt-out");
});

test("enabled Claude manifest wiring matches hooks.enabled.json", async () => {
  const rows = [
    ...HOOKS.filter((hook) => hook.script !== "telemetry.mjs"),
    ...(await telemetryHookRows()).filter((row) => row.hosts.includes("claude-code")),
  ];
  const built = buildHookManifest("claude-code", rows);
  const expected = JSON.parse(readFileSync(
    path.join(ROOT, "test/fixtures/telemetry/claude-code/hooks.enabled.json"),
    "utf8",
  ));
  assert.deepEqual(built, expected);
});

test("checked-in Claude manifest has no telemetry rows", () => {
  assert.equal(readRepoFile(HOSTS["claude-code"].manifest).includes("telemetry.mjs"), false);
});

test("PreToolUse and PostToolUse nest MCP, web, and per-CLI Bash telemetry groups", () => {
  const enabled = JSON.parse(readFileSync(
    path.join(ROOT, "test/fixtures/telemetry/claude-code/hooks.enabled.json"),
    "utf8",
  )).hooks;
  const [pre] = enabled.PreToolUse;
  assert.equal(pre.matcher, `^(?:${ARCADE_TOOL_PREFIX}|${CLAUDE_AI_ARCADE_TOOL_PREFIX})`);
  for (const event of ["PostToolUse", "PostToolUseFailure"]) {
    const groups = enabled[event];
    assert.equal(groups.length, 3);
    assert.equal(groups[0].matcher, "mcp__.*");
    assert.equal(groups[1].matcher, "WebFetch|WebSearch");
    assert.equal(groups[2].matcher, "Bash");
    assert.equal(groups[2].hooks.length, BASH_CLIS.length);
    for (const hook of groups[2].hooks) {
      assert.ok(hook.if);
      assert.ok(hook.command.endsWith(`--cli ${hook.if.match(/^Bash\((\w+) \*\)$/)[1]}`));
    }
  }
});

test("every enabled telemetry command exits quietly with telemetry off", async () => {
  const enabled = JSON.parse(readFileSync(
    path.join(ROOT, "test/fixtures/telemetry/claude-code/hooks.enabled.json"),
    "utf8",
  ));
  const commands = Object.values(enabled.hooks)
    .flatMap((groups) => groups.flatMap((group) => group.hooks))
    .map((hook) => hook.command)
    .filter((command) => command.includes("/hooks/telemetry.mjs"));
  const rows = (await telemetryHookRows()).filter((row) => row.hosts.includes("claude-code"));
  assert.equal(commands.length, rows.length);
  const server = await startServer();
  try {
    const dataDir = tempDataDir();
    // A sendable prompt; runTelemetryScript drops inherited opt-outs, so an open gate would post.
    const input = hookInput({ hook_event_name: "UserPromptSubmit", prompt: "What is on my calendar tomorrow?" });
    const env = telemetryEnv(adapter, dataDir, server.url);
    for (const row of rows) {
      const result = runTelemetryScript(JSON.stringify(input), env, "claude-code", row.extraArgs ?? []);
      assert.equal(result.status, 0, `${row.event} ${row.matcher ?? ""}: ${result.stderr}`);
      assert.equal(result.stdout, "", row.event);
      assert.equal(result.stderr, "", row.event);
    }
    await assertSilentThenServerReachable({ server, adapter, input, env: hookEnv(env) });
    assert.deepEqual(readdirSync(dataDir), []);
  } finally {
    await server.close();
  }
});

test("invalid telemetry inputs are ignored without affecting hooks", async () => {
  const dataDir = tempDataDir();
  const env = telemetryEnv(adapter, dataDir, "http://127.0.0.1:9");
  const cases = [
    "not-json",
    JSON.stringify({ hook_event_name: "UserPromptSubmit" }),
    JSON.stringify(hookInput({ hook_event_name: "UnknownHook" })),
    JSON.stringify(hookInput({ hook_event_name: "PreToolUse", tool_name: "not-mcp" })),
  ];
  for (const stdin of cases) {
    const result = runTelemetryScript(stdin, env);
    assert.equal(result.status, 0, stdin);
    assert.equal(result.stdout, "");
  }
  const routing = spawnSync(process.execPath, [path.join(ROOT, "hooks", "session-start.mjs"), "--host", "claude-code"], {
    input: "not-json",
    encoding: "utf8",
  });
  assert.equal(routing.status, 0);
});

test("buildEvent uses adapter tool properties for malformed tool names", () => {
  const options = { adapter, os: "darwin", arcadeUsedBefore: false, appWork: true };
  assert.equal(buildEvent(hookInput({ hook_event_name: "PreToolUse", tool_name: 42 }), options), null);
  assert.equal(isArcadeCall(buildEvent(hookInput({
    hook_event_name: "PostToolUse",
    tool_name: `${ARCADE_TOOL_PREFIX}Gmail_ListEmails`,
  }), options)), true);
});
