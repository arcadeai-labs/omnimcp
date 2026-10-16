// Installs this repo into a throwaway Copilot CLI home and checks that Copilot
// loads every MCP server in mcp.json and every skill in skills/.
//
// Copilot CLI has no plugin validate command. `copilot plugin install` fails
// on a broken plugin.json but not on a broken mcp.json or skill, so this
// reads back what Copilot loaded. No sign-in is needed.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginName = JSON.parse(readFileSync(join(root, "plugin.json"), "utf8")).name;
const servers = JSON.parse(readFileSync(join(root, "mcp.json"), "utf8")).mcpServers;
const skills = readdirSync(join(root, "skills")).filter((name) => existsSync(join(root, "skills", name, "SKILL.md")));

const work = mkdtempSync(join(tmpdir(), "arcade-copilot-verify-"));
const env = { ...process.env, COPILOT_HOME: work };

function copilot(...args) {
  const result = spawnSync("copilot", args, { cwd: work, env, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`copilot ${args.join(" ")} exited ${result.status}:\n${result.stdout}${result.stderr}`);
  }
  return result.stdout;
}

const problems = [];
try {
  copilot("plugin", "install", root);

  const loaded = JSON.parse(copilot("mcp", "list", "--json")).mcpServers;
  for (const [name, server] of Object.entries(servers)) {
    const match = loaded[name];
    if (match?.sourcePlugin !== pluginName) problems.push(`MCP server "${name}" from mcp.json was not loaded from the plugin`);
    else if (match.url !== server.url) problems.push(`MCP server "${name}" has url ${match.url}, expected ${server.url}`);
  }

  const loadedSkills = JSON.parse(copilot("skill", "list", "--json"));
  for (const skill of skills) {
    if (!loadedSkills.some((entry) => entry.name === skill && entry.source === "plugin")) {
      problems.push(`skill "${skill}" was not loaded from the plugin`);
    }
  }
} catch (error) {
  problems.push(error.message);
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error(`Copilot CLI check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Copilot CLI loaded ${Object.keys(servers).length} MCP server(s) and ${skills.length} skill(s) from the plugin.`);
