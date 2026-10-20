#!/usr/bin/env node
// Installs the plugin with Claude Code into a temporary config directory and
// fails if the installed copy has node_modules, which means Claude Code ran a
// package install. The Claude plugin directory holds such a version for a
// reviewer ("Dependencies install from a lockfile"):
// https://claude.com/docs/plugins/pre-submission-checklist
//
// Usage: node dev/scripts/verify-claude-install.mjs [repo-path]
// Uses `claude` from PATH. The repo path defaults to this checkout.

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LOCKFILES = ["package-lock.json", "npm-shrinkwrap.json", "bun.lock", "bun.lockb"];
// Shorter than the CI job limit, so a hung `claude` fails with its command named.
const CLAUDE_TIMEOUT_MS = 5 * 60_000;

/** The files git would commit: tracked plus untracked-but-not-ignored, minus deleted ones. */
function listFiles(root) {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const listed = [...new Set(output.split("\0").filter(Boolean))];
  return listed.filter((file) => lstatSync(join(root, file), { throwIfNoEntry: false })?.isFile());
}

function claude(args, env) {
  const result = spawnSync("claude", args, { env, encoding: "utf8", timeout: CLAUDE_TIMEOUT_MS });
  if (result.error?.code === "ETIMEDOUT") {
    throw new Error(`claude ${args.join(" ")} did not finish within ${CLAUDE_TIMEOUT_MS / 60_000} minutes`);
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`claude ${args.join(" ")} exited with ${result.status}:\n${result.stdout}${result.stderr}`);
  }
}

/** Returns a success message, or throws with the reason the install is wrong. */
function verifyInstall(repo, copy, config) {
  for (const file of listFiles(repo)) {
    mkdirSync(dirname(join(copy, file)), { recursive: true });
    copyFileSync(join(repo, file), join(copy, file));
  }

  const marketplace = JSON.parse(readFileSync(join(copy, ".claude-plugin/marketplace.json"), "utf8"));
  const plugin = marketplace.plugins[0].name;
  // Pass only PATH and the temp-folder, Windows system, and locale variables
  // below. Do not copy the parent environment.
  const env = { PATH: process.env.PATH ?? "", CLAUDE_CONFIG_DIR: config };
  for (const name of ["PATHEXT", "SystemRoot", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL"]) {
    const value = process.env[name];
    if (value) env[name] = value;
  }
  claude(["plugin", "marketplace", "add", copy], env);
  claude(["plugin", "install", `${plugin}@${marketplace.name}`], env);

  const pluginCache = join(config, "plugins", "cache", marketplace.name, plugin);
  const versions = existsSync(pluginCache) ? readdirSync(pluginCache) : [];
  if (versions.length !== 1) {
    throw new Error(`expected one installed version under ${pluginCache}, found ${versions.length}`);
  }
  const installed = join(pluginCache, versions[0]);
  if (!existsSync(join(installed, ".claude-plugin", "plugin.json"))) {
    throw new Error(`${plugin}@${marketplace.name} ${versions[0]} installed without .claude-plugin/plugin.json`);
  }
  if (existsSync(join(installed, "node_modules"))) {
    throw new Error(`${plugin}@${marketplace.name} ${versions[0]} installed with node_modules, so Claude Code ran a package install`);
  }
  // Claude Code keeps node_modules only when the install succeeds, so a failed
  // or timed-out install shows up only as these files.
  const lockfile = LOCKFILES.find((file) => existsSync(join(installed, file)));
  if (lockfile && existsSync(join(installed, "package.json"))) {
    throw new Error(`${plugin}@${marketplace.name} ${versions[0]} installed with package.json and ${lockfile} at its root, so Claude Code tries a package install`);
  }
  return `${plugin}@${marketplace.name} ${versions[0]} installed from ${repo} with no node_modules`;
}

const repo = resolve(process.argv[2] ?? DEFAULT_ROOT);
const copy = mkdtempSync(join(tmpdir(), "plugin-copy-"));
const config = mkdtempSync(join(tmpdir(), "claude-config-"));
try {
  console.log(`PASS: ${verifyInstall(repo, copy, config)}`);
} catch (error) {
  console.log(`FAIL: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  rmSync(copy, { recursive: true, force: true });
  rmSync(config, { recursive: true, force: true });
}
