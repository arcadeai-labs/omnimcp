import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { readRepoFile, ROOT } from "./helpers.mjs";

test(".cursor-plugin paths exist", () => {
  const manifest = JSON.parse(readRepoFile(".cursor-plugin/plugin.json"));
  assert.equal(manifest.displayName, "Arcade");
  for (const key of ["skills", "agents", "commands", "rules", "logo"]) {
    assert.ok(existsSync(path.join(ROOT, manifest[key])), `missing ${manifest[key]}`);
  }
});

test("commands are named arcade-* and listed in the support matrix and README", () => {
  const matrix = readRepoFile("docs/support-matrix.md");
  const readme = readRepoFile("README.md");
  for (const file of readdirSync(path.join(ROOT, "commands"))) {
    const name = file.replace(/\.md$/, "");
    assert.match(name, /^arcade-/);
    assert.match(readRepoFile(`commands/${file}`), new RegExp(`^name: ${name}$`, "m"));
    assert.match(matrix, new RegExp(`/arcade:${name}`));
    assert.match(readme, new RegExp(`/${name}\\b`));
  }
});

test("Claude marketplace lists the plugin as Arcade", () => {
  const [listed] = JSON.parse(readRepoFile(".claude-plugin/marketplace.json")).plugins;
  assert.equal(listed.displayName, "Arcade");
});
