import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  FILE_SOURCES,
  FILES_WITH_GENERATED_RULES,
  FILES_WITH_GENERATED_TABLES,
  generateManifests,
  requireSources,
} from "../scripts/generate-manifests.mjs";
import { makeFixture, readRepoFile, ROOT } from "./helpers.mjs";

// A second copy of FILE_SOURCES on purpose, so a change to a file's sources must change this test too.
const EXPECTED_SOURCES = {
  "plugin.json": ["dev/scripts/generate-manifests.mjs"],
  ".cursor-plugin/plugin.json": ["plugin.json", "mcp.json", "VERSION", "hooks/hook-hosts.mjs", "dev/scripts/generate-manifests.mjs"],
  ".claude-plugin/plugin.json": ["plugin.json", "mcp.json", "VERSION", "hooks/hook-hosts.mjs", "dev/scripts/generate-manifests.mjs"],
  ".claude-plugin/marketplace.json": ["plugin.json", "dev/scripts/generate-manifests.mjs"],
  "clients/cursor/rules/arcade.mdc": ["hooks/routing-guidance.mjs", "dev/scripts/generate-manifests.mjs"],
  ".gitattributes": ["hooks/hook-hosts.mjs", "dev/scripts/generate-manifests.mjs"],
  ".claude-plugin/hooks.json": ["hooks/hook-hosts.mjs", "dev/scripts/generate-manifests.mjs"],
  "clients/cursor/hooks/hooks.json": ["hooks/hook-hosts.mjs", "dev/scripts/generate-manifests.mjs"],
  "com.github.copilot/hooks/hooks.json": ["hooks/hook-hosts.mjs", "dev/scripts/generate-manifests.mjs"],
  "skills/scale-arcade/references/arcade-docs.md": ["skills/try-arcade/references/arcade-docs.md"],
  "com.github.copilot/agents/arcade-operator.agent.md": ["agents/arcade-operator.agent.md", "hooks/routing-guidance.mjs"],
  "agents/arcade-operator.agent.md": ["hooks/routing-guidance.mjs"],
  "skills/try-arcade/SKILL.md": ["hooks/routing-guidance.mjs"],
  "docs/telemetry.md": ["hooks/telemetry-contract.mjs"],
};

test("FILE_SOURCES lists the expected sources for every generated path", () => {
  assert.deepEqual(FILE_SOURCES, EXPECTED_SOURCES);
});

test("committed generated files are current (run npm run generate if not)", () => {
  generateManifests({ check: true });
});

test("check mode fails with a source-naming error when a generated file is hand-edited", () => {
  const root = makeFixture();
  try {
    const files = generateManifests({ root });
    assert.deepEqual([...files.keys()].sort(), Object.keys(EXPECTED_SOURCES).sort());

    for (const path of files.keys()) {
      // Reset to clean state before each edit.
      generateManifests({ root });

      const fullPath = join(root, path);
      if (path in FILES_WITH_GENERATED_RULES) {
        // Edit inside the block so the rules-block path is specifically tested.
        writeFileSync(fullPath, readFileSync(fullPath, "utf8").replace("Gateway: Arcade is connected", "Gateway: Any server is connected"));
      } else if (FILES_WITH_GENERATED_TABLES.includes(path)) {
        // Only the tables are generated, so the edit has to be inside them.
        writeFileSync(fullPath, readFileSync(fullPath, "utf8").replace("Service categories:", "Service kinds:"));
      } else if (path === "plugin.json") {
        const plugin = JSON.parse(readFileSync(fullPath, "utf8"));
        plugin.extensions["com.openai"].interface.privacyPolicyURL = "https://example.com/stale";
        writeFileSync(fullPath, `${JSON.stringify(plugin, null, 2)}\n`);
      } else {
        writeFileSync(fullPath, `${readFileSync(fullPath, "utf8")} `);
      }

      assert.throws(
        () => generateManifests({ check: true, root }),
        (err) => {
          for (const s of [path, ...EXPECTED_SOURCES[path]]) {
            assert.ok(err.message.includes(s), `error for ${path} should name ${s}: ${err.message}`);
          }
          assert.ok(
            err.message.includes("Run npm run generate"),
            `error for ${path} should say to run npm run generate: ${err.message}`,
          );
          return true;
        },
      );
    }

    // Stale .gitattributes entry: a path that was once generated but no longer
    // is, left in the committed .gitattributes. Different error path from above.
    generateManifests({ root });
    writeFileSync(
      join(root, ".gitattributes"),
      `${readFileSync(join(root, ".gitattributes"), "utf8")}old/file.json linguist-generated=true\n`,
    );
    assert.throws(
      () => generateManifests({ check: true, root }),
      /old\/file\.json is no longer generated/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("requireSources throws when a generated path has no FILE_SOURCES entry", () => {
  const incomplete = { ...FILE_SOURCES };
  delete incomplete[".gitattributes"];
  assert.throws(
    () => requireSources(".gitattributes", incomplete),
    /\.gitattributes has no entry in FILE_SOURCES/,
  );
});

// Mirrors what release-please does with release-please-config.json.
// omnimcp doesn't run Release Please, so its mirror has no config.
const releasePleaseSkip = !existsSync(join(ROOT, "release-please-config.json")) && "no release-please-config.json";
test("a release-please version bump leaves generated files in sync", { skip: releasePleaseSkip }, () => {
  const root = makeFixture();
  const config = JSON.parse(readRepoFile("release-please-config.json")).packages["."];
  try {
    generateManifests({ root });
    writeFileSync(join(root, config["version-file"]), "9.9.9\n");
    for (const { path, jsonpath } of config["extra-files"]) {
      const file = join(root, path);
      const document = JSON.parse(readFileSync(file, "utf8"));
      const keys = jsonpath.replace(/^\$\./, "").replace(/\[(\d+)\]/g, ".$1").split(".");
      const last = keys.pop();
      keys.reduce((node, key) => node[key], document)[last] = "9.9.9";
      writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);
    }
    generateManifests({ check: true, root });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Exercise the real source constant, rather than a second URL setting or an override.
test("changing the canonical privacy URL updates both client fields", async () => {
  const root = makeFixture();
  try {
    cpSync(join(ROOT, "hooks"), join(root, "hooks"), { recursive: true });
    mkdirSync(join(root, "dev/scripts"), { recursive: true });
    cpSync(join(ROOT, "dev/scripts/telemetry-docs.mjs"), join(root, "dev/scripts/telemetry-docs.mjs"));
    const generator = readRepoFile("dev/scripts/generate-manifests.mjs").replace(
      'const privacyPolicyUrl = "https://www.arcade.dev/privacy-policy/";',
      'const privacyPolicyUrl = "https://example.com/new-policy/";',
    );
    writeFileSync(join(root, "dev/scripts/generate-manifests.mjs"), generator);
    const changedGenerator = await import(pathToFileURL(join(root, "dev/scripts/generate-manifests.mjs")));
    changedGenerator.generateManifests({ root });
    const read = (file) => JSON.parse(readFileSync(join(root, file), "utf8"));
    assert.equal(read(".claude-plugin/plugin.json").privacyPolicyUrl, "https://example.com/new-policy/");
    assert.equal(read("plugin.json").extensions["com.openai"].interface.privacyPolicyURL, "https://example.com/new-policy/");
    assert.ok(!readFileSync(join(root, ".gitattributes"), "utf8").includes("\nplugin.json "));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
