import assert from "node:assert/strict";
import { test } from "node:test";
import { HOOKS, HOSTS } from "../hooks/hook-hosts.mjs";
import { TELEMETRY_ENABLED } from "../hooks/telemetry-config.mjs";
import { buildHookManifest } from "../scripts/generate-manifests.mjs";
import { readRepoFile } from "./helpers.mjs";

// Turning collection on needs its own approval after ingestion, opt-outs, and
// the privacy and distribution requirements are verified. Change this test
// only with that approval.
test("telemetry is off in this build", () => {
  assert.equal(TELEMETRY_ENABLED, false);
});

test("no generated hooks.json runs the telemetry hook while telemetry is off", () => {
  assert.equal(HOOKS.some((hook) => hook.script === "telemetry.mjs"), false);
  for (const { manifest } of Object.values(HOSTS)) {
    assert.equal(readRepoFile(manifest).includes("telemetry.mjs"), false, manifest);
  }
});

test("nested manifests group entries by event and matcher and keep if and extra args", () => {
  const rows = [
    { script: "a.mjs", event: "PostToolUse", matcher: "mcp__.*" },
    { script: "b.mjs", event: "PostToolUse", matcher: "Bash", if: "Bash(gh *)", extraArgs: ["--cli", "gh"] },
    { script: "c.mjs", event: "PostToolUse", matcher: "mcp__.*" },
    { script: "d.mjs", event: "PostToolUse", hosts: ["copilot"] },
  ];
  const { hooks } = buildHookManifest("claude-code", rows);
  assert.deepEqual(hooks.PostToolUse.map((group) => group.matcher), ["mcp__.*", "Bash"]);
  assert.equal(hooks.PostToolUse[0].hooks.length, 2);
  const [bash] = hooks.PostToolUse[1].hooks;
  assert.equal(bash.if, "Bash(gh *)");
  assert.match(bash.command, /\/hooks\/b\.mjs" --host claude-code --cli gh$/);
});

test("flat manifests keep matchers and reject if and extra args", () => {
  const { hooks } = buildHookManifest("cursor", [{ script: "a.mjs", event: "SessionStart", matcher: "x" }]);
  assert.equal(hooks.sessionStart[0].matcher, "x");
  assert.throws(
    () => buildHookManifest("cursor", [{ script: "a.mjs", event: "SessionStart", if: "Bash(gh *)" }]),
    /flat format does not support/,
  );
});
