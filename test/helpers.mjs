import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COPIED_FILES, FILES_WITH_GENERATED_RULES } from "../scripts/generate-manifests.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const readRepoFile = (relativePath) =>
  readFileSync(path.join(ROOT, relativePath), "utf8");

export const runHook = (script, input = {}, args = []) =>
  spawnSync("node", [path.join(ROOT, "hooks", script), ...args], {
    input: JSON.stringify(input),
    encoding: "utf8",
  });

/** @param {string} script */
export const powerShellArgs = (script) => ["-NoProfile", "-NonInteractive", "-Command", script];

/** @type {string | undefined | null} */
let powerShell = null;
/** The PowerShell executable, or undefined when none is installed. GitHub's ubuntu-latest image includes pwsh. */
export const findPowerShell = () => {
  if (powerShell === null) {
    powerShell = (process.platform === "win32" ? ["pwsh", "powershell.exe"] : ["pwsh"]).find(
      (exe) => !spawnSync(exe, powerShellArgs("exit 0")).error,
    );
  }
  return powerShell;
};

export const powerShellExe = () => {
  const exe = findPowerShell();
  if (!exe) throw new Error("PowerShell not found; guard the test with skipWithoutPowerShell()");
  return exe;
};

export const skipWithoutPowerShell = () => ({ skip: !findPowerShell() && "pwsh not found" });

/**
 * @param {string} script
 * @param {import("node:child_process").SpawnSyncOptions} options
 */
export const runPowerShell = (script, options) =>
  spawnSync(powerShellExe(), powerShellArgs(script), { encoding: "utf8", ...options });

// The `command` field is the macOS and Linux form; cmd.exe can't run it.
export const skipOnWindows = { skip: process.platform === "win32" && "the command field is for macOS and Linux" };

/** A temp copy of the generator's source files, for tests that write. */
export const makeFixture = () => {
  const root = mkdtempSync(path.join(tmpdir(), "arcade-plugin-"));
  const sources = ["VERSION", "plugin.json", "mcp.json", ...Object.keys(FILES_WITH_GENERATED_RULES), ...Object.values(COPIED_FILES).flat()];
  for (const file of sources) {
    cpSync(path.join(ROOT, file), path.join(root, file));
  }
  return root;
};
