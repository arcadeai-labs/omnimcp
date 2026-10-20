// Runs Cursor's plugin validator (cursor/plugin-template) against this repo.
//
// Cursor publishes the validator without a license, so the repo doesn't keep a
// copy. No script in the plugin downloads it either, because the Claude plugin
// directory scans the plugin for code that downloads and runs other code. CI
// downloads it in the "Download Cursor's validator" step of
// .github/workflows/check.yml in ArcadeAI/arcade-plugin; to run this locally,
// run that step's command in dev/ first. To update it, change the commit in
// that step and VALIDATOR_SHA256 here together (`shasum -a 256` on the
// downloaded file).
//
// The validator only checks the default rules/, skills/, agents/, commands/,
// and hooks/hooks.json paths, so it always warns that hooks/hooks.json is
// missing (Cursor's hooks live in clients/cursor/hooks/) and skips the rule in
// clients/cursor/rules/; dev/test/check.test.mjs checks that rule instead.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VALIDATOR_SHA256 = "826f55f546ce59500a6e3d7d32a15d90f3373cecc3b41486e75ae28b60647a4a";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const validatorFile = join(root, "dev/.cache/validate-template.mjs");

if (!existsSync(validatorFile)) {
  console.error(
    `Cursor's validator is missing at ${validatorFile}. Download it with the command in the ` +
      `"Download Cursor's validator" step of ArcadeAI/arcade-plugin's .github/workflows/check.yml, run from dev/.`,
  );
  process.exit(1);
}
const validator = readFileSync(validatorFile);
const hash = createHash("sha256").update(validator).digest("hex");
if (hash !== VALIDATOR_SHA256) {
  console.error(`Cursor's validator at ${validatorFile} has sha256 ${hash}, expected ${VALIDATOR_SHA256}.`);
  process.exit(1);
}

// The validator only reads plugins listed in .cursor-plugin/marketplace.json.
// This repo is a single plugin and has no marketplace file, so the validator
// runs in a temp folder holding a one-entry marketplace file and a link back
// to this repo.
const work = mkdtempSync(join(tmpdir(), "arcade-cursor-validate-"));
let status = 1;
try {
  const plugin = JSON.parse(readFileSync(join(root, ".cursor-plugin/plugin.json"), "utf8"));
  const marketplace = {
    name: plugin.name,
    owner: { name: plugin.author.name },
    plugins: [{ name: plugin.name, source: "plugin" }],
  };
  mkdirSync(join(work, ".cursor-plugin"));
  writeFileSync(join(work, ".cursor-plugin/marketplace.json"), `${JSON.stringify(marketplace, null, 2)}\n`);
  symlinkSync(root, join(work, "plugin"), "junction");

  const validatorPath = join(work, "validate-template.mjs");
  writeFileSync(validatorPath, validator);
  status = spawnSync(process.execPath, [validatorPath], { cwd: work, stdio: "inherit" }).status ?? 1;
} finally {
  // Remove the link to the repo on its own before the recursive delete, so the
  // cleanup can never reach the repo's files.
  rmSync(join(work, "plugin"), { force: true });
  rmSync(work, { recursive: true, force: true });
}
process.exit(status);
