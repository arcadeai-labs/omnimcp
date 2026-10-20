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

test("Claude marketplace keeps its listing identity and support contact", () => {
  const marketplace = JSON.parse(readRepoFile(".claude-plugin/marketplace.json"));
  const { author } = JSON.parse(readRepoFile("plugin.json"));
  assert.equal(marketplace.name, "arcade");
  assert.deepEqual(marketplace.owner, { ...author, email: "support@arcade.dev" });
  const [listed] = marketplace.plugins;
  assert.equal(listed.name, "arcade");
  assert.equal(listed.source, "./");
  assert.equal(listed.repository, "https://github.com/ArcadeAI/arcade-plugin");
  assert.deepEqual(listed.author, author);
  assert.equal(listed.displayName, "Arcade");
});

test("Claude manifest displays Arcade without changing the install identifier", () => {
  const manifest = JSON.parse(readRepoFile(".claude-plugin/plugin.json"));
  assert.equal(manifest.displayName, "Arcade");
  assert.equal(manifest.name, "arcade");
});

test("listing contact and privacy metadata agree across clients", () => {
  const portable = JSON.parse(readRepoFile("plugin.json"));
  const claude = JSON.parse(readRepoFile(".claude-plugin/plugin.json"));
  const cursor = JSON.parse(readRepoFile(".cursor-plugin/plugin.json"));
  const marketplace = JSON.parse(readRepoFile(".claude-plugin/marketplace.json"));
  assert.equal(marketplace.owner.email, "support@arcade.dev");
  assert.equal(claude.privacyPolicyUrl, "https://www.arcade.dev/privacy-policy/");
  assert.equal(portable.extensions["com.openai"].interface.privacyPolicyURL, claude.privacyPolicyUrl);
  assert.equal(portable.privacyPolicyUrl, undefined);
  for (const author of [portable.author, claude.author, cursor.author, marketplace.plugins[0].author]) {
    assert.equal(author.email, undefined);
  }
});
