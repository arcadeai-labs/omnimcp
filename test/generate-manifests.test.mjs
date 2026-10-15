import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  FILE_SOURCES,
  FILES_WITH_GENERATED_RULES,
  generateManifests,
  requireSources,
} from "../scripts/generate-manifests.mjs";
import { makeFixture, readRepoFile } from "./helpers.mjs";

// A second copy of FILE_SOURCES on purpose, so a change to a file's sources must change this test too.
const EXPECTED_SOURCES = {
  ".cursor-plugin/plugin.json": ["plugin.json", "mcp.json", "VERSION", "hooks/hook-hosts.mjs", "scripts/generate-manifests.mjs"],
  ".claude-plugin/plugin.json": ["plugin.json", "mcp.json", "VERSION", "hooks/hook-hosts.mjs", "scripts/generate-manifests.mjs"],
  ".claude-plugin/marketplace.json": ["plugin.json", "scripts/generate-manifests.mjs"],
  "clients/cursor/rules/arcade.mdc": ["hooks/routing-guidance.mjs", "scripts/generate-manifests.mjs"],
  ".gitattributes": ["hooks/hook-hosts.mjs", "scripts/generate-manifests.mjs"],
  ".claude-plugin/hooks.json": ["hooks/hook-hosts.mjs", "scripts/generate-manifests.mjs"],
  "clients/cursor/hooks/hooks.json": ["hooks/hook-hosts.mjs", "scripts/generate-manifests.mjs"],
  "com.github.copilot/hooks/hooks.json": ["hooks/hook-hosts.mjs", "scripts/generate-manifests.mjs"],
  "skills/scale-arcade/references/arcade-docs.md": ["skills/try-arcade/references/arcade-docs.md"],
  "com.github.copilot/agents/arcade-operator.agent.md": ["agents/arcade-operator.agent.md", "hooks/routing-guidance.mjs"],
  "agents/arcade-operator.agent.md": ["hooks/routing-guidance.mjs"],
  "skills/try-arcade/SKILL.md": ["hooks/routing-guidance.mjs"],
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
test("a release-please version bump leaves generated files in sync", () => {
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
