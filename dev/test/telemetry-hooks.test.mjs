import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHookManifest } from "../scripts/generate-manifests.mjs";

test("a flat-format client can't get an entry with if or extra args", () => {
  const row = { script: "telemetry.mjs", event: "SessionStart", if: "Bash(gh *)", extraArgs: ["--cli", "gh"] };
  assert.throws(() => buildHookManifest("copilot", [row]), /flat format does not support/);
});
