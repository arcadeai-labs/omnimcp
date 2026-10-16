import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { classifyAppWork, MAX_SCOPE_FILES, SCOPE_DIRECTORY, SCOPE_TTL_MS, scopeForInput } from "../hooks/hook-scope.mjs";
import { buildEvent } from "../hooks/telemetry-events.mjs";
import fakeAdapter, { FAKE_ARCADE_PREFIX } from "./fixtures/telemetry-fake-adapter.mjs";

const root = mkdtempSync(path.join(os.tmpdir(), "arcade-scope-"));
after(() => rmSync(root, { recursive: true, force: true }));
const makeDir = () => mkdtempSync(path.join(root, "data-"));
const prompt = (text, turn = "turn-1", session = "session-1") => ({
  hook_event_name: "UserPromptSubmit", prompt: text, prompt_id: turn, session_id: session,
});
const tool = (turn = "turn-1", session = "session-1") => ({
  hook_event_name: "PostToolUse", tool_name: "WebFetch", prompt_id: turn, session_id: session,
});
const options = (dir, now = 1000, requiresTurn = true) => ({ host: "claude-code", requiresTurn, dir, now });

test("confirmation relevance expires from the original app prompt and unrelated work closes it", () => {
  const initial = classifyAppWork("Check my calendar", null, 1000);
  assert.equal(initial.relevant, true);
  for (const text of ["ok", "yes, send it", "go ahead and send it", "do it"]) {
    assert.deepEqual(classifyAppWork(text, initial, 2000), initial, text);
  }
  assert.equal(classifyAppWork("yes, send it", initial, initial.expiresAt).relevant, false);
  assert.equal(classifyAppWork("Fix the parser", initial, 2000).relevant, false);
  assert.equal(classifyAppWork("continue the implementation", initial, 2000).relevant, false);
  assert.equal(classifyAppWork("yes, send it", null, 2000).relevant, false);
});

test("scope isolates sessions and Claude turns, preserves notifications, and resets on session start", () => {
  const dir = makeDir();
  assert.equal(scopeForInput(tool(), options(dir)).appWork, false);
  assert.equal(scopeForInput(prompt("Check my calendar"), options(dir)).appWork, true);
  assert.equal(scopeForInput(tool(), options(dir)).appWork, true);
  assert.equal(scopeForInput(tool("different-turn"), options(dir)).appWork, false);
  assert.equal(scopeForInput(tool("turn-1", "different-session"), options(dir)).appWork, false);
  assert.equal(scopeForInput({ ...tool(), prompt_id: undefined }, options(dir)).appWork, false);
  assert.equal(scopeForInput(prompt("<task-notification>Fix the parser</task-notification>", "notification"), options(dir)).appWork, false);
  assert.equal(scopeForInput(tool(), options(dir)).appWork, true);
  const confirmation = prompt("yes, send it", "turn-2");
  assert.equal(scopeForInput(confirmation, options(dir, 2000)).appWork, true);
  const file = path.join(dir, SCOPE_DIRECTORY, readdirSync(path.join(dir, SCOPE_DIRECTORY))[0]);
  const state = JSON.parse(readFileSync(file, "utf8"));
  assert.deepEqual(Object.keys(state).sort(), ["expiresAt", "relevant", "turn"]);
  assert.equal(state.expiresAt, 1000 + SCOPE_TTL_MS);
  assert.doesNotMatch(readFileSync(file, "utf8"), /calendar|send|session-1|turn-2/);
  scopeForInput(confirmation, options(dir, 3000));
  assert.equal(JSON.parse(readFileSync(file, "utf8")).expiresAt, state.expiresAt, "hook order does not extend scope");
  assert.equal(scopeForInput(tool("turn-2"), options(dir, state.expiresAt)).appWork, false);
  scopeForInput({ hook_event_name: "SessionStart", session_id: "session-1" }, options(dir));
  assert.equal(scopeForInput(tool("turn-2"), options(dir)).appWork, false);
  scopeForInput(prompt("Check my calendar", "turn-3"), options(dir));
  scopeForInput({ hook_event_name: "SessionStart", session_id: "session-1", source: "compact" }, options(dir));
  assert.equal(scopeForInput(tool("turn-3"), options(dir)).appWork, true, "compaction keeps scope");
  scopeForInput(prompt("Fix the parser", "turn-4"), options(dir));
  assert.equal(scopeForInput(tool("turn-4"), options(dir)).appWork, false);
});

test("Copilot uses bounded session scope without a prompt id and corrupt state fails closed", () => {
  const dir = makeDir();
  const config = { ...options(dir), host: "copilot-cli", requiresTurn: false };
  scopeForInput({ ...prompt("Check my calendar"), prompt_id: undefined }, config);
  assert.equal(scopeForInput({ ...tool(), prompt_id: undefined }, config).appWork, true);
  const file = path.join(dir, SCOPE_DIRECTORY, readdirSync(path.join(dir, SCOPE_DIRECTORY))[0]);
  for (const bad of ["not json", '{"relevant":true}', JSON.stringify({ relevant: true, expiresAt: 1000 + SCOPE_TTL_MS, prompt: "private" })]) {
    writeFileSync(file, bad);
    assert.equal(scopeForInput({ ...tool(), prompt_id: undefined }, config).appWork, false);
  }
});

test("expired session state is removed and stored sessions are bounded", () => {
  const dir = makeDir();
  scopeForInput(prompt("Check my calendar", "old-turn", "old-session"), options(dir));
  const oldFile = readdirSync(path.join(dir, SCOPE_DIRECTORY))[0];
  for (let i = 0; i <= MAX_SCOPE_FILES; i++) {
    scopeForInput(prompt("Check my calendar", `turn-${i}`, `session-${i}`), options(dir, 1000 + SCOPE_TTL_MS));
  }
  const files = readdirSync(path.join(dir, SCOPE_DIRECTORY));
  assert.equal(files.includes(oldFile), false);
  assert.equal(files.length, MAX_SCOPE_FILES);
});

test("unscoped alternatives and unrelated hooks are silent, while direct Arcade use stays observable", () => {
  const eventOptions = { adapter: fakeAdapter, os: "darwin", arcadeUsedBefore: false, appWork: false };
  for (const input of [tool(), prompt("Fix the parser"), { ...tool(), tool_name: "mcp__fake_other__Granola_ListMeetings" },
    { ...tool(), hook_event_name: "SessionStart" }, { ...tool(), hook_event_name: "SubagentStop", agent_type: "general-purpose" }]) {
    assert.equal(buildEvent(input, eventOptions), null);
  }
  for (const hook of ["PreToolUse", "PostToolUse", "PostToolUseFailure"]) {
    assert.ok(buildEvent({ ...tool(), hook_event_name: hook, tool_name: `${FAKE_ARCADE_PREFIX}Gmail_ListEmails` }, eventOptions));
  }
});
