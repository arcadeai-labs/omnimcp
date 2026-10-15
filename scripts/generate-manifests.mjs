#!/usr/bin/env node
// Writes every client-specific file from the sources listed in
// ARCHITECTURE.md. `--check` fails instead of writing if anything is stale.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CURSOR_RULE,
  OPERATOR_RULES,
  SKILL_RULES,
} from "../hooks/routing-guidance.mjs";
import { HOOK_TIMEOUT_SEC, HOOKS, HOSTS } from "../hooks/hook-hosts.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Claude Code and Cowork only accept the operator at the default agents/ path
// (the CLI wants .md paths in "agents", Cowork wants folders). Copilot CLI and
// VS Code only read com.github.copilot/agents/, so that folder gets a copy.
const OPERATOR = "agents/arcade-operator.agent.md";
const CURSOR_RULE_DIR = "clients/cursor/rules";

/** Hand-written files that contain one generated block of routing rules. */
export const FILES_WITH_GENERATED_RULES = {
  [OPERATOR]: OPERATOR_RULES,
  "skills/try-arcade/SKILL.md": SKILL_RULES,
};

/** Generated copy → the file it is copied from. */
export const COPIED_FILES = {
  // Each skill folder has to work on its own.
  "skills/scale-arcade/references/arcade-docs.md": "skills/try-arcade/references/arcade-docs.md",
  "com.github.copilot/agents/arcade-operator.agent.md": OPERATOR,
};

/**
 * Source files for each generated or partially-generated path. Used in error
 * messages so a person who hand-edits a generated file knows what to edit
 * instead. Every path that buildFiles adds to its output map must have an
 * entry here — buildFiles throws if one is missing.
 */
export const FILE_SOURCES = {
  // plugin.json and mcp.json supply identity and the gateway URL; VERSION
  // supplies the version; hook-hosts.mjs supplies the hooks manifest path; the
  // script writes the fixed skills/agents/commands/rules paths.
  ".cursor-plugin/plugin.json": ["plugin.json", "mcp.json", "VERSION", "hooks/hook-hosts.mjs", "scripts/generate-manifests.mjs"],
  // The script writes the mcpServers transport type.
  ".claude-plugin/plugin.json": ["plugin.json", "mcp.json", "VERSION", "hooks/hook-hosts.mjs", "scripts/generate-manifests.mjs"],
  // The script writes the marketplace description. There is no version field.
  ".claude-plugin/marketplace.json": ["plugin.json", "scripts/generate-manifests.mjs"],
  // The script writes the frontmatter and the header comment.
  [`${CURSOR_RULE_DIR}/arcade.mdc`]: ["hooks/routing-guidance.mjs", "scripts/generate-manifests.mjs"],
  // The hook manifest paths in the list come from hook-hosts.mjs.
  ".gitattributes": ["hooks/hook-hosts.mjs", "scripts/generate-manifests.mjs"],
  // hook-hosts.mjs supplies the events, scripts, and timeout; the script writes
  // the version, entry type, nesting, and command template. With telemetry
  // enabled, the adapter that hook-hosts.mjs names supplies telemetry entries.
  ...Object.fromEntries(
    Object.values(HOSTS).map((h) => [h.manifest, ["hooks/hook-hosts.mjs", "scripts/generate-manifests.mjs"]]),
  ),
  "skills/scale-arcade/references/arcade-docs.md": ["skills/try-arcade/references/arcade-docs.md"],
  // A copy of the operator with its rules block filled in.
  "com.github.copilot/agents/arcade-operator.agent.md": [OPERATOR, "hooks/routing-guidance.mjs"],
  [OPERATOR]: ["hooks/routing-guidance.mjs"],
  "skills/try-arcade/SKILL.md": ["hooks/routing-guidance.mjs"],
};

/** Formats an array of source paths as a human-readable list. */
const joinSources = (sources) => {
  if (sources.length === 1) return sources[0];
  if (sources.length === 2) return `${sources[0]} and ${sources[1]}`;
  return `${sources.slice(0, -1).join(", ")}, and ${sources.at(-1)}`;
};

/**
 * Throws if `path` has no entry in `fileSources`. Exported so tests can call
 * it directly with an incomplete sources map.
 */
export const requireSources = (path, fileSources) => {
  if (!(path in fileSources)) {
    throw new Error(
      `${path} has no entry in FILE_SOURCES — add one in scripts/generate-manifests.mjs next to where it is built`,
    );
  }
};

/** Returns the error message to throw when `path` is out of date on disk. */
const outOfDateError = (path) => {
  if (path in FILES_WITH_GENERATED_RULES) {
    return `${path}: the rules block is out of date. Run npm run generate. If you edited the block by hand, make the change in hooks/routing-guidance.mjs instead.`;
  }
  const sources = FILE_SOURCES[path];
  const joined = joinSources(sources);
  if (path in COPIED_FILES) {
    return `${path} is out of date. Run npm run generate. If you edited ${path} by hand, make the change in ${joined} instead (this file is a copy).`;
  }
  return `${path} is out of date. Run npm run generate. If you edited ${path} by hand, make the change in ${joined} instead.`;
};

const RULES_BLOCK_BEGIN =
  "<!-- BEGIN generated from hooks/routing-guidance.mjs by `npm run generate`; edit that file, not this block -->";
const RULES_BLOCK_END = "<!-- END generated -->";

const readText = (root, path) => readFileSync(join(root, path), "utf8");
const readJson = (root, path) => JSON.parse(readText(root, path));
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

const fillRulesBlock = (text, rules, path) => {
  const begin = text.indexOf(RULES_BLOCK_BEGIN);
  const end = text.indexOf(RULES_BLOCK_END);
  if (begin === -1 || end < begin) {
    throw new Error(`${path} is missing the generated rules block markers`);
  }
  return `${text.slice(0, begin + RULES_BLOCK_BEGIN.length)}\n${rules}\n${text.slice(end)}`;
};

/**
 * The command fields of one hook entry. With `runOnlyIfScriptExists`, the
 * command runs the script only if the file is there, so a client that leaves
 * the root variable unset (VS Code) gets exit 0 and no output. `powershell`
 * is intended for Windows (not verified); it has no double quotes because VS
 * Code is expected to pass it as one argument to `powershell.exe -Command`.
 */
const hookCommandFields = (hostName, script) => {
  const { rootVariable, runOnlyIfScriptExists } = HOSTS[hostName];
  const scriptPath = `\${${rootVariable}}/hooks/${script}`;
  const command = `node "${scriptPath}" --host ${hostName}`;
  if (!runOnlyIfScriptExists) return { command };
  const psPath = `($env:${rootVariable} + '/hooks/${script}')`;
  return {
    command: `if [ -f "${scriptPath}" ]; then ${command}; fi`,
    powershell: `if ($env:${rootVariable} -and (Test-Path -LiteralPath ${psPath})) { node ${psPath} --host ${hostName} }`,
  };
};

// Claude Code nests each command in a group: { hooks: { Event: [{ matcher, hooks: [entry] }] } },
// with one group per event and matcher. Cursor, Copilot CLI, and VS Code take
// the entries directly and need version 1.
export const buildHookManifest = (hostName, hookRows = HOOKS) => {
  const host = HOSTS[hostName];
  const nested = host.format === "nested";
  const hooks = {};
  for (const hook of hookRows) {
    if (hook.hosts && !hook.hosts.includes(hostName)) continue;
    const name = host.events ? host.events[hook.event] : hook.event;
    if (!name) continue;
    hooks[name] ??= [];
    if (!nested) {
      if (hook.if || hook.extraArgs) {
        throw new Error(`${hook.script} entry for ${hostName} has if or extra args, which the flat format does not support`);
      }
      const entry = { type: "command", ...hookCommandFields(hostName, hook.script), timeout: HOOK_TIMEOUT_SEC };
      hooks[name].push({ ...entry, ...(hook.matcher ? { matcher: hook.matcher } : {}) });
      continue;
    }
    const { command } = hookCommandFields(hostName, hook.script);
    const entry = {
      type: "command",
      ...(hook.if ? { if: hook.if } : {}),
      command: [command, ...(hook.extraArgs ?? [])].join(" "),
      timeout: HOOK_TIMEOUT_SEC,
    };
    let group = hooks[name].find((existing) => existing.matcher === hook.matcher);
    if (!group) {
      group = { ...(hook.matcher ? { matcher: hook.matcher } : {}), hooks: [] };
      hooks[name].push(group);
    }
    group.hooks.push(entry);
  }
  return nested ? { hooks } : { version: 1, hooks };
};

/** Every generated file and its contents, from the sources in `root`. */
const buildFiles = (root) => {
  const plugin = readJson(root, "plugin.json");
  const version = readText(root, "VERSION").trim();
  if (plugin.version !== version) {
    throw new Error(`plugin.json version ${plugin.version} does not match VERSION ${version}`);
  }
  const { url } = readJson(root, "mcp.json").mcpServers.arcade;
  const { interface: openaiListing } = plugin.extensions["com.openai"];
  const { displayName } = openaiListing;
  if (!openaiListing.logo) {
    throw new Error("plugin.json extensions.com.openai.interface.logo is missing");
  }
  // Codex wants "./assets/logo.png"; Cursor takes "assets/logo.png". The Claude
  // marketplace has no logo field.
  const logo = openaiListing.logo.replace(/^\.\//, "");
  const { name, description, author, homepage, license, keywords, repository } = plugin;
  const identity = { name, description, author, homepage, license, keywords, version };

  const files = new Map([
    [
      ".cursor-plugin/plugin.json",
      serialize({
        ...identity,
        displayName,
        logo,
        repository,
        skills: "skills",
        agents: "agents",
        commands: "commands",
        rules: CURSOR_RULE_DIR,
        hooks: HOSTS.cursor.manifest,
        // Cursor infers the transport from the URL.
        mcpServers: { arcade: { url } },
      }),
    ],
    [
      ".claude-plugin/plugin.json",
      serialize({
        ...identity,
        hooks: `./${HOSTS["claude-code"].manifest}`,
        // Claude Code needs "http"; the Agent Plugins mcp.json says "streamable-http".
        mcpServers: { arcade: { type: "http", url } },
      }),
    ],
    [
      ".claude-plugin/marketplace.json",
      serialize({
        $schema: "https://json.schemastore.org/claude-code-marketplace.json",
        name,
        // Marketplace listing text. Codex also installs from this marketplace.
        description: "Install Arcade in Claude Desktop, Cowork, Claude Code, and Codex.",
        owner: author,
        // No version here: Claude Code takes it from .claude-plugin/plugin.json.
        plugins: [
          { name, displayName, source: "./", description, author, homepage, repository, license, keywords },
        ],
      }),
    ],
    [
      `${CURSOR_RULE_DIR}/arcade.mdc`,
      [
        "---",
        "description: Prefer Arcade for external service tasks",
        "alwaysApply: true",
        "---",
        "",
        "<!-- Generated from hooks/routing-guidance.mjs by `npm run generate`. Edit that file, not this one. -->",
        "",
        CURSOR_RULE,
        "",
      ].join("\n"),
    ],
  ]);

  for (const [hostName, host] of Object.entries(HOSTS)) {
    files.set(host.manifest, serialize(buildHookManifest(hostName)));
  }

  for (const [copy, source] of Object.entries(COPIED_FILES)) {
    const rules = FILES_WITH_GENERATED_RULES[source];
    files.set(copy, rules ? fillRulesBlock(readText(root, source), rules, source) : readText(root, source));
  }

  // GitHub collapses linguist-generated files in pull request diffs.
  files.set(
    ".gitattributes",
    [
      "# Written by `npm run generate`. Lists every fully generated file.",
      ...[...files.keys()].map((path) => `${path} linguist-generated=true`),
      "",
    ].join("\n"),
  );

  for (const [path, rules] of Object.entries(FILES_WITH_GENERATED_RULES)) {
    files.set(path, fillRulesBlock(readText(root, path), rules, path));
  }

  // Every output must have a source entry so error messages can name it.
  for (const path of files.keys()) {
    requireSources(path, FILE_SOURCES);
  }

  return files;
};

export const generateManifests = ({ check = false, root = ROOT } = {}) => {
  const files = buildFiles(root);
  if (check) {
    // A path in the committed .gitattributes that is no longer generated is a
    // leftover from a removed source and should be deleted.
    const committed = existsSync(join(root, ".gitattributes"))
      ? readText(root, ".gitattributes").match(/^\S+(?= linguist-generated)/gm) ?? []
      : [];
    for (const path of committed) {
      if (!files.has(path)) throw new Error(`${path} is no longer generated — delete it`);
    }
  }
  for (const [path, content] of files) {
    const absolutePath = join(root, path);
    if (check) {
      if (!existsSync(absolutePath) || readFileSync(absolutePath, "utf8") !== content) {
        throw new Error(outOfDateError(path));
      }
      continue;
    }
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, "utf8");
  }
  return files;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  try {
    const files = generateManifests({ check });
    console.log(`${check ? "check" : "generate"}: ${files.size} files`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
