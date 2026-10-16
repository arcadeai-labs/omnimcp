import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { applyAcceptedListing, entryFromBytes } from "../.github/legacy-projection.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const headFile = (relativePath) => execFileSync("git", ["show", `HEAD:${relativePath}`], {
  cwd: ROOT,
  encoding: "utf8",
});

test("the listing patch reproduces the committed generator and marketplace", () => {
  for (const relativePath of ["scripts/generate-manifests.mjs", ".claude-plugin/marketplace.json"]) {
    const patched = applyAcceptedListing(relativePath, entryFromBytes("100644", headFile(relativePath)));
    assert.equal(patched.bytes.toString("utf8"), readFileSync(path.join(ROOT, relativePath), "utf8"), relativePath);
  }
});

test("the listing patch keeps the accepted install id and canonical repository", () => {
  const patched = JSON.parse(applyAcceptedListing(
    ".claude-plugin/marketplace.json",
    entryFromBytes("100644", headFile(".claude-plugin/marketplace.json")),
  ).bytes.toString("utf8"));
  assert.equal(patched.name, "arcade");
  assert.equal(patched.owner.email, "support@arcade.dev");
  assert.equal(patched.plugins[0].name, "arcade");
  assert.equal(patched.plugins[0].source, "./");
  assert.equal(patched.plugins[0].repository, "https://github.com/ArcadeAI/arcade-plugin");
});
