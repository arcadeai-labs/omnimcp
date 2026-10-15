// Checks for the hand-written files that `npm run generate` doesn't cover.

import assert from "node:assert/strict";
import Ajv2020 from "ajv/dist/2020.js";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { SESSION_CONTEXT } from "../hooks/routing-guidance.mjs";
import { readRepoFile, ROOT } from "./helpers.mjs";

const plugin = JSON.parse(readRepoFile("plugin.json"));
const endpoint = JSON.parse(readRepoFile("mcp.json")).mcpServers.arcade.url;
const slug = new URL(plugin.repository).pathname.slice(1);

test("plugin.json and mcp.json match the vendored Agent Plugins 1.0 schemas", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  for (const file of ["plugin.json", "mcp.json"]) {
    const validate = ajv.compile(JSON.parse(readRepoFile(`schemas/agent-plugins/1.0.0/${file.replace(".json", ".schema.json")}`)));
    assert.ok(validate(JSON.parse(readRepoFile(file))), `${file}: ${ajv.errorsText(validate.errors)}`);
  }
  const openaiListing = plugin.extensions?.["com.openai"]?.interface;
  assert.ok(openaiListing?.displayName, "plugin.json: Codex displayName");
  for (const key of ["logo", "composerIcon"]) {
    const file = openaiListing?.[key];
    assert.ok(file && existsSync(path.join(ROOT, file)), `plugin.json: Codex ${key} must point at a committed file`);
    // Codex's own plugins all write these paths with a leading "./".
    assert.match(file, /^\.\//, `plugin.json: Codex ${key} must start with ./`);
  }
});

test("hand-written files name the gateway from mcp.json", () => {
  assert.ok(readRepoFile("README.md").includes(endpoint), `README.md: must reference ${endpoint}`);
  assert.ok(SESSION_CONTEXT.includes(new URL(endpoint).host), "routing rules must name the gateway host");
});

// Clients load these default locations on their own, which would add a second
// copy of the operator, gateway, or rule.
test("no root folders that clients would load a second time", () => {
  for (const name of ["rules", ".mcp.json", "hooks/hooks.json"]) {
    assert.ok(!existsSync(path.join(ROOT, name)), `unexpected root ${name}`);
  }
});

// Cursor's validator (npm run verify:cursor) only checks frontmatter in a root
// rules/ folder, and this repo keeps its rule under clients/cursor/rules/.
test("every Cursor rule has a description in its frontmatter", () => {
  const dir = "clients/cursor/rules";
  for (const file of readdirSync(path.join(ROOT, dir)).filter((name) => name.endsWith(".mdc"))) {
    const frontmatter = readRepoFile(`${dir}/${file}`).match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
    assert.match(frontmatter, /^description: \S/m, `${dir}/${file}: missing description in frontmatter`);
  }
});

test("install docs name the repo and link every client page", () => {
  const index = readRepoFile("docs/install/README.md");
  for (const file of ["docs/install/README.md", "docs/install/claude-code.md", "docs/install/claude-desktop.md"]) {
    assert.ok(readRepoFile(file).includes(`claude plugin marketplace add ${slug}`), file);
  }
  for (const page of readdirSync(path.join(ROOT, "docs/install"))) {
    if (page !== "README.md") assert.ok(index.includes(`(${page})`), `${page} not linked from docs/install/README.md`);
  }
});

// Claude Code and Cowork read the same .claude-plugin/plugin.json but disagree
// on "agents": the Claude Code CLI requires .md paths, and Cowork's upload
// check rejects them ("No agent files found in specified directories"). The
// default agents/ folder is the only layout both accept.
test("the operator sits at the default agents/ path and no manifest overrides it for Claude", () => {
  assert.ok(existsSync(path.join(ROOT, "agents/arcade-operator.agent.md")));
  assert.equal(JSON.parse(readRepoFile(".claude-plugin/plugin.json")).agents, undefined);
});
