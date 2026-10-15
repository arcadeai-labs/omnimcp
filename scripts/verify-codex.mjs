// Installs this repo into a throwaway Codex home and checks that Codex loads
// every MCP server in mcp.json and every skill in skills/.
//
// Codex has no plugin validate command, and `codex plugin add` succeeds even
// when mcp.json or a skill is broken, so this reads back what Codex loaded.
// No sign-in is needed.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginName = JSON.parse(readFileSync(join(root, "plugin.json"), "utf8")).name;
const marketplaceName = JSON.parse(readFileSync(join(root, ".claude-plugin/marketplace.json"), "utf8")).name;
const servers = JSON.parse(readFileSync(join(root, "mcp.json"), "utf8")).mcpServers;
const skills = readdirSync(join(root, "skills")).filter((name) => existsSync(join(root, "skills", name, "SKILL.md")));

// HOME is replaced too, because Codex also reads ~/.agents/plugins/.
const work = mkdtempSync(join(tmpdir(), "arcade-codex-verify-"));
const env = { ...process.env, HOME: join(work, "home"), CODEX_HOME: join(work, "codex") };
mkdirSync(env.HOME);
mkdirSync(env.CODEX_HOME);

function codex(...args) {
  // Run outside the repo so Codex doesn't also load the repo's own AGENTS.md.
  const result = spawnSync("codex", args, { cwd: env.HOME, env, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`codex ${args.join(" ")} exited ${result.status}:\n${result.stdout}${result.stderr}`);
  }
  return result.stdout;
}

const problems = [];
try {
  codex("plugin", "marketplace", "add", root);
  codex("plugin", "add", `${pluginName}@${marketplaceName}`);

  const loaded = JSON.parse(codex("mcp", "list", "--json"));
  for (const [name, server] of Object.entries(servers)) {
    const match = loaded.find((entry) => entry.name === name);
    if (!match) problems.push(`MCP server "${name}" from mcp.json was not loaded`);
    else if (match.transport?.url !== server.url) {
      problems.push(`MCP server "${name}" has url ${match.transport?.url}, expected ${server.url}`);
    }
  }

  // The prompt Codex would send lists every skill it loaded as <plugin>:<skill>.
  const prompt = codex("debug", "prompt-input");
  for (const skill of skills) {
    if (!prompt.includes(`${pluginName}:${skill}`)) problems.push(`skill "${skill}" was not loaded`);
  }
} catch (error) {
  problems.push(error.message);
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error(`Codex check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Codex loaded ${Object.keys(servers).length} MCP server(s) and ${skills.length} skill(s).`);
