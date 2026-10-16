import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { EVENTS, eventSchema } from "../hooks/telemetry-contract.mjs";
import { EVENT_ENV, PLUGIN_VERSION, POSTHOG_KEY, TELEMETRY_ENABLED } from "../hooks/telemetry-config.mjs";
import { buildEvent, isArcadeCall } from "../hooks/telemetry-events.mjs";
import { SCOPE_DIRECTORY, scopeForInput } from "../hooks/hook-scope.mjs";
import { clearSessionScope, isOptedOut, runTelemetry } from "../hooks/telemetry-run.mjs";
import { ROOT, runHook } from "./helpers.mjs";
import fakeAdapter, { FAKE_ARCADE_PREFIX, FAKE_OTHER_PREFIX } from "./fixtures/telemetry-fake-adapter.mjs";
import {
  assertMatchesContract,
  assertNoLeak,
  captureTelemetry,
  expectedEvent,
  hash16,
  hookInput,
  runTelemetryScript,
  sleep,
  startServer,
  telemetryEnv,
  waitForRequests,
} from "./telemetry-helpers.mjs";
import Ajv2020 from "ajv/dist/2020.js";

const SESSION_ID = "raw-session-id-123";
const PROMPT_ID = "raw-prompt-id-456";
const OPERATOR = "arcade:arcade-operator";
const OPTIONS = { adapter: fakeAdapter, os: "darwin", arcadeUsedBefore: false, appWork: true };

const TEMP_ROOT = mkdtempSync(path.join(os.tmpdir(), "arcade-telemetry-foundation-"));
const makeTempDir = () => mkdtempSync(path.join(TEMP_ROOT, "data-"));
after(() => rmSync(TEMP_ROOT, { recursive: true, force: true }));

const HOOK_EVENTS = [...new Set(Object.values(EVENTS).map((spec) => spec.hook))];

test("telemetry is off in this build", () => {
  assert.equal(TELEMETRY_ENABLED, false);
});

test("telemetry.mjs exits before work when telemetry is disabled", async () => {
  const server = await startServer();
  try {
    const dataDir = makeTempDir();
    const env = telemetryEnv(fakeAdapter, dataDir, server.url);
    for (const host of ["claude-code", "copilot"]) {
      for (const hook_event_name of HOOK_EVENTS) {
        const input = JSON.stringify(hookInput({ hook_event_name, prompt: "calendar" }));
        const result = runTelemetryScript(input, env, host);
        assert.equal(result.status, 0, `${host} ${hook_event_name}: ${result.stderr}`);
        assert.equal(result.stdout, "", `${host} ${hook_event_name}`);
        assert.equal(result.stderr, "", `${host} ${hook_event_name}`);
      }
      const bad = runTelemetryScript("not-json", env, host);
      assert.equal(bad.status, 0);
      assert.equal(bad.stdout, "");
    }
    await sleep(300);
    assert.deepEqual(server.requests, []);
    assert.deepEqual(readdirSync(dataDir), []);
  } finally {
    await server.close();
  }
});

test("session-start with telemetry off creates no scope dir and still prints routing context", () => {
  const dataDir = makeTempDir();
  const result = runHook(
    "session-start.mjs",
    { session_id: SESSION_ID, source: "startup" },
    ["--host", "claude-code"],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("Gateway"));
  assert.deepEqual(readdirSync(dataDir), []);
});

test("routing hooks still exit 0 with malformed stdin", () => {
  for (const script of ["session-start.mjs", "subagent-start.mjs", "user-prompt-submit.mjs"]) {
    const result = spawnSync(process.execPath, [path.join(ROOT, "hooks", script), "--host", "claude-code"], {
      input: "not-json",
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
  }
});

test("buildEvent maps fake adapter hook input to contract events", () => {
  const ATTEMPTED = "Plugin tool attempted";
  const CALLED = "Plugin tool called";
  const FAILED = "Plugin tool failed";
  const cases = [
    ["UserPromptSubmit", { prompt: "What is on my calendar tomorrow?" }, "Plugin prompt submitted",
      { could_use_arcade: true, service_hints: ["calendar"], reminder_sent: true }],
    ["PreToolUse", { tool_name: `${FAKE_ARCADE_PREFIX}Arcade_SelectTools` }, ATTEMPTED,
      { server: "arcade", tool: "Arcade_SelectTools" }],
    ["PostToolUse", { tool_name: `${FAKE_ARCADE_PREFIX}Gmail_ListEmails` }, CALLED,
      { server: "arcade", tool: "app_tool", service: "email" }],
    ["PostToolUseFailure", { tool_name: `${FAKE_OTHER_PREFIX}DoThing`, error: "Error POSTing to endpoint: x" }, FAILED,
      { server: "other", failure_kind: "http_error" }],
    ["PreToolUse", { tool_name: `${FAKE_OTHER_PREFIX}search` }, null],
  ];
  for (const [hook, fields, event, extra] of cases) {
    const built = buildEvent(hookInput({ hook_event_name: hook, ...fields }), OPTIONS);
    if (event === null) {
      assert.equal(built, null);
      continue;
    }
    assert.deepEqual(built, expectedEvent(event, extra, fakeAdapter), `${hook}`);
    assertMatchesContract(built);
  }
});

test("buildEvent never leaks raw ids or prompt text", () => {
  const secrets = /SECRET|private-repo|raw-session|raw-prompt/i;
  const built = buildEvent(hookInput({
    hook_event_name: "UserPromptSubmit",
    prompt: "SECRET calendar",
    session_id: "SECRET-session",
    prompt_id: "SECRET-prompt",
  }), OPTIONS);
  assertNoLeak(JSON.stringify(built), secrets);
  assertMatchesContract(built);
});

test("contract schema rejects extra properties and values", () => {
  const valid = buildEvent(hookInput({
    hook_event_name: "UserPromptSubmit",
    prompt: "Check my calendar",
  }), OPTIONS);
  assertMatchesContract(valid);
  const validate = new Ajv2020({ allErrors: true }).compile(eventSchema());
  const withExtra = { ...valid, properties: { ...valid.properties, extra_field: "x" } };
  assert.equal(validate(withExtra), false);
  const badEnum = {
    ...valid,
    properties: { ...valid.properties, os: "freebsd" },
  };
  assert.equal(validate(badEnum), false);
});

test("isArcadeCall is true only for successful arcade gateway calls", () => {
  const arcade = buildEvent(hookInput({
    hook_event_name: "PostToolUse",
    tool_name: `${FAKE_ARCADE_PREFIX}Gmail_ListEmails`,
  }), OPTIONS);
  assert.equal(isArcadeCall(arcade), true);
  const attempt = buildEvent(hookInput({
    hook_event_name: "PreToolUse",
    tool_name: `${FAKE_ARCADE_PREFIX}Gmail_ListEmails`,
  }), OPTIONS);
  assert.equal(isArcadeCall(attempt), false);
});

test("runTelemetry opt-out matrix sends nothing and writes no files", async () => {
  const server = await startServer();
  try {
    const sent = [];
    const base = hookInput({ hook_event_name: "UserPromptSubmit", prompt: "Check my calendar" });
    const cases = [
      ["ARCADE_PLUGIN_TELEMETRY=0", { ARCADE_PLUGIN_TELEMETRY: "0" }],
      ["ARCADE_PLUGIN_TELEMETRY=OFF", { ARCADE_PLUGIN_TELEMETRY: "OFF" }],
      ["DO_NOT_TRACK=1", { DO_NOT_TRACK: "1" }],
      ["FAKE_DISABLE_TELEMETRY=1", { FAKE_DISABLE_TELEMETRY: "1" }],
      ["FAKE_DISABLE_TELEMETRY=0", { FAKE_DISABLE_TELEMETRY: "0" }],
      ["FAKE_OFFLINE=true", { FAKE_OFFLINE: "true" }],
      ["FAKE_OFFLINE=1", { FAKE_OFFLINE: "1" }],
      ["missing data dir", { ARCADE_TEST_PLUGIN_DATA: "" }],
      ["relative data dir", { ARCADE_TEST_PLUGIN_DATA: "relative/data" }],
    ];
    for (const [label, extra] of cases) {
      const dataDir = makeTempDir();
      const env = telemetryEnv(fakeAdapter, dataDir, server.url, extra);
      await runTelemetry({
        input: base,
        adapter: fakeAdapter,
        env,
        enabled: true,
        send: (event) => sent.push(event),
      });
      assert.deepEqual(readdirSync(dataDir), [], label);
    }
    await sleep(200);
    assert.deepEqual(server.requests, []);
    assert.deepEqual(sent, []);
  } finally {
    await server.close();
  }
});

test("captureTelemetry carries scope and sets arcade-used across prompt then tool events", async () => {
  const { sent: promptSent, dataDir } = await captureTelemetry({
    adapter: fakeAdapter,
    input: hookInput({ hook_event_name: "UserPromptSubmit", prompt: "Check my calendar" }),
  });
  assert.equal(promptSent.length, 1);
  assertMatchesContract(promptSent[0]);

  const { sent: toolSent } = await captureTelemetry({
    adapter: fakeAdapter,
    dataDir,
    input: hookInput({
      hook_event_name: "PostToolUse",
      tool_name: `${FAKE_ARCADE_PREFIX}Gmail_ListEmails`,
      prompt_id: PROMPT_ID,
    }),
  });
  assert.equal(toolSent.length, 1);
  assertMatchesContract(toolSent[0]);
  assert.equal(toolSent[0].properties.arcade_used_before, false);
  assert.equal(readFileSync(path.join(dataDir, "arcade-used"), "utf8"), "true");

  const { sent: attemptSent } = await captureTelemetry({
    adapter: fakeAdapter,
    dataDir,
    input: hookInput({
      hook_event_name: "PreToolUse",
      tool_name: `${FAKE_ARCADE_PREFIX}Gmail_ListEmails`,
      prompt_id: PROMPT_ID,
    }),
  });
  assert.equal(attemptSent.length, 1);
  assert.equal(attemptSent[0].properties.arcade_used_before, true);
  assert.equal(isArcadeCall(attemptSent[0]), false);
});

test("runTelemetry survives malformed input and send failures", async () => {
  const dataDir = makeTempDir();
  const env = telemetryEnv(fakeAdapter, dataDir, "http://127.0.0.1:9");
  await runTelemetry({ input: null, adapter: fakeAdapter, env, enabled: true, send: () => {} });
  await runTelemetry({ input: { hook_event_name: "UserPromptSubmit" }, adapter: fakeAdapter, env, enabled: true, send: () => {} });
  const scopeDir = path.join(dataDir, "prompt-scope");
  mkdirSync(scopeDir, { recursive: true });
  writeFileSync(path.join(scopeDir, "bad.json"), "not json");
  await runTelemetry({
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: `${FAKE_ARCADE_PREFIX}Gmail_ListEmails` }),
    adapter: fakeAdapter,
    env,
    enabled: true,
    send: () => { throw new Error("send failed"); },
  });
});

test("isOptedOut respects case on ARCADE_PLUGIN_TELEMETRY", () => {
  assert.equal(isOptedOut([], { ARCADE_PLUGIN_TELEMETRY: "OFF" }), true);
  assert.equal(isOptedOut([], { ARCADE_PLUGIN_TELEMETRY: "off" }), true);
  assert.equal(isOptedOut(fakeAdapter.optOutSwitches, { FAKE_OFFLINE: "FALSE" }), false);
});

test("telemetry-send posts one event and gives up on a silent host", async () => {
  const server = await startServer();
  const silent = net.createServer(() => {});
  await new Promise((resolve) => silent.listen(0, "127.0.0.1", resolve));
  const silentUrl = `http://127.0.0.1:${silent.address().port}`;
  try {
    const event = buildEvent(hookInput({ hook_event_name: "UserPromptSubmit", prompt: "calendar" }), OPTIONS);
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(ROOT, "hooks", "telemetry-send.mjs")], {
      env: { ...process.env, ARCADE_PLUGIN_TELEMETRY_HOST: server.url, [EVENT_ENV]: JSON.stringify(event) },
    });
    assert.equal(await new Promise((resolve) => child.on("exit", resolve)), 0);
    await waitForRequests(server.requests, 1);
    const body = JSON.parse(server.requests[0].body);
    assert.equal(body.api_key, POSTHOG_KEY);
    assert.equal(body.event, "Plugin prompt submitted");

    const hangStart = Date.now();
    const hang = spawn(process.execPath, [path.join(ROOT, "hooks", "telemetry-send.mjs")], {
      env: { ...process.env, ARCADE_PLUGIN_TELEMETRY_HOST: silentUrl, [EVENT_ENV]: JSON.stringify(event) },
    });
    assert.equal(await new Promise((resolve) => hang.on("exit", resolve)), 0);
    const elapsed = Date.now() - hangStart;
    assert.ok(elapsed >= 900 && elapsed < 5000, `timeout was ${elapsed} ms`);
    assert.ok(Date.now() - started < 5000);
  } finally {
    await server.close();
    silent.close();
  }
});

test("only the detached sender does network I/O", () => {
  const networkImport =
    /\bfetch\b|\b(?:from|import|require)\s*\(?\s*["'](?:node:)?(?:http|https|http2|net|tls|dgram|dns)["']/;
  const hookFiles = readdirSync(path.join(ROOT, "hooks")).filter((file) => file.endsWith(".mjs"));
  for (const file of hookFiles) {
    if (file === "telemetry-send.mjs") continue;
    const source = readFileSync(path.join(ROOT, "hooks", file), "utf8");
    assert.doesNotMatch(source, networkImport, file);
  }
  const adapterDir = path.join(ROOT, "hooks", "telemetry-adapters");
  if (existsSync(adapterDir)) {
    for (const file of readdirSync(adapterDir).filter((f) => f.endsWith(".mjs"))) {
      const label = `telemetry-adapters/${file}`;
      const source = readFileSync(path.join(adapterDir, file), "utf8");
      assert.doesNotMatch(source, networkImport, label);
    }
  }
});

test("telemetry.mjs prints nothing", () => {
  const source = readFileSync(path.join(ROOT, "hooks", "telemetry.mjs"), "utf8");
  assert.doesNotMatch(source, /\bconsole\.(log|info|warn|error)\b/);
});

test("telemetry.mjs statically imports only telemetry-config", () => {
  const source = readFileSync(path.join(ROOT, "hooks", "telemetry.mjs"), "utf8");
  const staticImports = [...source.matchAll(/^import\s.+from\s+["'](.+?)["']/gm)].map((match) => match[1]);
  assert.deepEqual(staticImports, ["./telemetry-config.mjs"]);
});

test("clearSessionScope off-state (enabled false) respects opt-out and SessionStart source", () => {
  const seedScope = (dir) => {
    scopeForInput(
      hookInput({ hook_event_name: "UserPromptSubmit", prompt: "Check my calendar", session_id: "scope-session" }),
      { host: fakeAdapter.host, requiresTurn: fakeAdapter.requiresTurn, dir, now: 1000 },
    );
    const scopeDir = path.join(dir, SCOPE_DIRECTORY);
    assert.equal(readdirSync(scopeDir).length, 1);
    return scopeDir;
  };
  const baseEnv = (dir) => telemetryEnv(fakeAdapter, dir, "http://127.0.0.1:9");

  const offDir = makeTempDir();
  const offScope = seedScope(offDir);
  clearSessionScope({
    adapter: fakeAdapter,
    env: baseEnv(offDir),
    input: { session_id: "scope-session", source: "startup" },
    enabled: false,
  });
  assert.equal(readdirSync(offScope).length, 1, "disabled telemetry leaves scope files");

  const optedDir = makeTempDir();
  const optedScope = seedScope(optedDir);
  clearSessionScope({
    adapter: fakeAdapter,
    env: { ...baseEnv(optedDir), ARCADE_PLUGIN_TELEMETRY: "0" },
    input: { session_id: "scope-session", source: "startup" },
    enabled: true,
  });
  assert.equal(readdirSync(optedScope).length, 1, "opt-out leaves scope files");

  const compactDir = makeTempDir();
  const compactScope = seedScope(compactDir);
  clearSessionScope({
    adapter: fakeAdapter,
    env: baseEnv(compactDir),
    input: { session_id: "scope-session", source: "compact" },
    enabled: true,
  });
  assert.equal(readdirSync(compactScope).length, 1, "compact session start keeps scope");

  const freshDir = makeTempDir();
  const freshScope = seedScope(freshDir);
  assert.equal(readdirSync(freshScope).length, 1);
  clearSessionScope({
    adapter: fakeAdapter,
    env: baseEnv(freshDir),
    input: { session_id: "scope-session", source: "startup" },
    enabled: true,
  });
  assert.equal(readdirSync(freshScope).length, 0, "normal session start clears scope");
});

test("every telemetry source file starts with @ts-check", () => {
  const files = readdirSync(path.join(ROOT, "hooks"))
    .filter((file) => file.startsWith("telemetry") && file.endsWith(".mjs"))
    .map((file) => `hooks/${file}`);
  const adapterDir = path.join(ROOT, "hooks", "telemetry-adapters");
  try {
    for (const file of readdirSync(adapterDir).filter((f) => f.endsWith(".mjs"))) {
      files.push(`hooks/telemetry-adapters/${file}`);
    }
  } catch {
    // no adapters yet on this slice
  }
  for (const file of files) {
    assert.match(readFileSync(path.join(ROOT, file), "utf8"), /^(#!.*\n)?\/\/ @ts-check\n/, file);
  }
});

test("scope expiry and confirmation flow via runTelemetry", async () => {
  const dataDir = makeTempDir();
  const env = telemetryEnv(fakeAdapter, dataDir, "http://127.0.0.1:9");
  const now = 1_000_000;
  const events = [];
  await runTelemetry({
    input: hookInput({ hook_event_name: "UserPromptSubmit", prompt: "Check my calendar", prompt_id: "turn-1" }),
    adapter: fakeAdapter,
    env,
    enabled: true,
    now,
    send: (e) => events.push(e),
  });
  await runTelemetry({
    input: hookInput({ hook_event_name: "UserPromptSubmit", prompt: "yes, send it", prompt_id: "turn-2" }),
    adapter: fakeAdapter,
    env,
    enabled: true,
    now: now + 1000,
    send: (e) => events.push(e),
  });
  assert.equal(events.length, 2);
  assert.equal(events[1].properties.could_use_arcade, false);
  await runTelemetry({
    input: hookInput({ hook_event_name: "PostToolUse", tool_name: "WebFetch", prompt_id: "turn-2" }),
    adapter: fakeAdapter,
    env,
    enabled: true,
    now: now + 2000,
    send: (e) => events.push(e),
  });
  assert.equal(events.length, 3);
});

test("subagent-stop builds operator status for fake adapter", () => {
  const built = buildEvent(hookInput({
    hook_event_name: "SubagentStop",
    agent_type: OPERATOR,
    last_assistant_message: "status: needs_auth",
  }), OPTIONS);
  assert.equal(built.properties.status, "needs_auth");
  assertMatchesContract(built);
});
