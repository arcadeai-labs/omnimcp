// @ts-check

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { ROOT } from "./helpers.mjs";
import { tempDataDir } from "./telemetry-helpers.mjs";

test("tempDataDir keeps directories from every test until the file ends, then removes them all", () => {
  const helpers = pathToFileURL(path.join(ROOT, "dev", "test", "telemetry-helpers.mjs")).href;
  const file = path.join(tempDataDir(), "uses-temp-dirs.test.mjs");
  writeFileSync(file, `
import { existsSync } from "node:fs";
import { test } from "node:test";
import { tempDataDir } from ${JSON.stringify(helpers)};
const made = [];
for (const name of ["first", "second", "third"]) {
  test(name, () => {
    const dir = tempDataDir();
    made.push(dir);
    console.log("TEMP_DIR " + dir);
  });
}
test("directories from earlier tests still exist", () => {
  for (const dir of made) if (!existsSync(dir)) throw new Error("removed early: " + dir);
});
`);
  // Without NODE_TEST_CONTEXT the child prints readable TAP instead of the runner's binary protocol.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [file], { encoding: "utf8", env });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const dirs = [...result.stdout.matchAll(/^TEMP_DIR (.+)$/gm)].map((match) => match[1]);
  assert.equal(dirs.length, 3, result.stdout);
  for (const dir of dirs) assert.equal(existsSync(dir), false, `left behind: ${dir}`);
});
