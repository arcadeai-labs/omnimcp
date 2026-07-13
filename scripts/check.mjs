#!/usr/bin/env node
// Repo-wide structural checks for the OmniMCP plugin package.
// No dependencies; run with: node scripts/check.mjs

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENDPOINT = "https://omni.arcade.dev/mcp";
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const errors = [];
const fail = (message) => errors.push(message);
const read = (path) => readFileSync(join(ROOT, path), "utf8");

// --- JSON validity -----------------------------------------------------------
const jsonFiles = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (entry === ".git" || entry === "node_modules") continue;
    const rel = join(dir, entry);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
    else if (entry.endsWith(".json")) jsonFiles.push(rel);
  }
};
walk(".");

const json = {};
for (const file of jsonFiles) {
  try {
    json[file] = JSON.parse(read(file));
  } catch (parseError) {
    fail(`${file}: invalid JSON — ${parseError.message}`);
  }
}

// --- No root default-discovery locations ------------------------------------
for (const forbidden of ["skills", "agents", "commands", "hooks", "rules", "mcp.json", ".mcp.json"]) {
  if (existsSync(join(ROOT, forbidden))) {
    fail(`root ${forbidden} exists — components must live under components/ or clients/ and be declared explicitly`);
  }
}

// --- Manifest component paths exist ------------------------------------------
// Rules are a Cursor-only component; every other component must be declared
// explicitly in both manifests.
const manifestKeys = {
  ".cursor-plugin/plugin.json": ["rules", "skills", "agents", "commands", "hooks", "mcpServers"],
  ".claude-plugin/plugin.json": ["skills", "agents", "commands", "hooks", "mcpServers"],
};
for (const [manifest, pathKeys] of Object.entries(manifestKeys)) {
  const data = json[manifest];
  if (!data) continue;
  for (const key of pathKeys) {
    if (!(key in data)) {
      fail(`${manifest}: missing explicit "${key}" declaration`);
      continue;
    }
    const values = Array.isArray(data[key]) ? data[key] : [data[key]];
    for (const value of values) {
      if (typeof value !== "string") continue;
      const target = value.replace(/^\.\//, "");
      if (!existsSync(join(ROOT, target))) fail(`${manifest}: ${key} path does not exist: ${value}`);
    }
  }
}

// --- Frontmatter -------------------------------------------------------------
const frontmatter = (path) => {
  const text = read(path);
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^([A-Za-z][A-Za-z-]*):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2];
  }
  return fields;
};

const componentNames = new Map();
const registerName = (name, source) => {
  if (componentNames.has(name)) fail(`duplicate component name "${name}" (${componentNames.get(name)} and ${source})`);
  else componentNames.set(name, source);
};

for (const skillDir of readdirSync(join(ROOT, "components/skills"))) {
  const path = `components/skills/${skillDir}/SKILL.md`;
  const fields = frontmatter(path);
  if (!fields?.name || !fields?.description) fail(`${path}: frontmatter must include name and description`);
  else {
    if (fields.name !== skillDir) fail(`${path}: frontmatter name "${fields.name}" != directory "${skillDir}"`);
    if (!KEBAB.test(fields.name)) fail(`${path}: name is not kebab-case`);
    registerName(fields.name, path);
  }
}
for (const agentFile of readdirSync(join(ROOT, "components/agents"))) {
  const path = `components/agents/${agentFile}`;
  const fields = frontmatter(path);
  if (!fields?.name || !fields?.description) fail(`${path}: frontmatter must include name and description`);
  else {
    if (!KEBAB.test(fields.name)) fail(`${path}: name is not kebab-case`);
    registerName(fields.name, path);
  }
}
for (const commandFile of readdirSync(join(ROOT, "components/commands"))) {
  const path = `components/commands/${commandFile}`;
  const fields = frontmatter(path);
  if (!fields?.description) fail(`${path}: frontmatter must include description`);
  registerName(commandFile.replace(/\.md$/, ""), path);
}
for (const ruleFile of readdirSync(join(ROOT, "clients/cursor/rules"))) {
  const path = `clients/cursor/rules/${ruleFile}`;
  const fields = frontmatter(path);
  if (!fields?.description || !("alwaysApply" in fields)) {
    fail(`${path}: rule frontmatter must include description and alwaysApply`);
  }
}

// --- Version consistency ------------------------------------------------------
const versions = {
  ".cursor-plugin/plugin.json": json[".cursor-plugin/plugin.json"]?.version,
  ".claude-plugin/plugin.json": json[".claude-plugin/plugin.json"]?.version,
  "clients/opencode/package.json": json["clients/opencode/package.json"]?.version,
};
if (new Set(Object.values(versions)).size !== 1) {
  fail(`version mismatch: ${JSON.stringify(versions)}`);
}
const version = Object.values(versions)[0];
if (version && !read("CHANGELOG.md").includes(`## [${version}]`)) {
  fail(`CHANGELOG.md has no entry for ${version}`);
}

// --- Endpoint consistency ------------------------------------------------------
for (const file of [
  "clients/cursor/mcp.json",
  "clients/claude/mcp.json",
  "clients/claude-desktop/claude_desktop_config.json",
  "clients/opencode/opencode.json",
  "clients/opencode/index.ts",
]) {
  if (!read(file).includes(ENDPOINT)) fail(`${file}: does not reference ${ENDPOINT}`);
}

// --- MCP server key ------------------------------------------------------------
for (const file of ["clients/cursor/mcp.json", "clients/claude/mcp.json", "clients/claude-desktop/claude_desktop_config.json"]) {
  if (!json[file]?.mcpServers?.arcade) fail(`${file}: mcpServers must define the "arcade" server key`);
}

// --- Hook scripts execute with client-native shapes ---------------------------
const runHook = (script) => {
  try {
    return JSON.parse(execFileSync("node", [join(ROOT, script)], { encoding: "utf8", timeout: 10_000 }));
  } catch (execError) {
    fail(`${script}: failed to execute or emit JSON — ${execError.message}`);
    return null;
  }
};
const cursorHook = runHook("clients/cursor/hooks/session-start.mjs");
if (cursorHook && typeof cursorHook.additional_context !== "string") {
  fail("clients/cursor/hooks/session-start.mjs: must emit flat { additional_context } (Cursor-native shape)");
}
const claudeHook = runHook("clients/claude/hooks/session-start-availability.mjs");
if (claudeHook && claudeHook.hookSpecificOutput?.hookEventName !== "SessionStart") {
  fail("clients/claude/hooks/session-start-availability.mjs: must emit hookSpecificOutput.hookEventName = SessionStart");
}

// --- Language consistency -------------------------------------------------------
const userFacing = [
  "components/commands/do.md",
  "components/commands/apps.md",
  "components/commands/tools.md",
  "components/skills/using-arcade-tools/SKILL.md",
  "components/skills/managing-arcade-apps/SKILL.md",
  "clients/cursor/rules/omni-tool-discovery.mdc",
];
for (const file of userFacing) {
  if (/authorization link/i.test(read(file))) {
    fail(`${file}: says "authorization link" — user-facing copy uses "sign-in link"`);
  }
}

// --- Report --------------------------------------------------------------------
if (errors.length > 0) {
  console.error(`check.mjs: ${errors.length} problem(s)\n`);
  for (const message of errors) console.error(`  ✗ ${message}`);
  process.exit(1);
}
console.log(`check.mjs: all checks passed (${jsonFiles.length} JSON files, version ${version})`);
