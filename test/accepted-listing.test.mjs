import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { applyAcceptedListing, desiredTree, entryFromBytes, gitBlobSha, hydrateAcceptedListing } from "../.github/legacy-projection.mjs";

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

test("a sha-only listing entry fails before reading missing bytes", () => {
  assert.throws(
    () => applyAcceptedListing("scripts/generate-manifests.mjs", { mode: "100644", blobSha: "abc" }),
    (error) => {
      assert.equal(error instanceof TypeError, false);
      assert.match(error.message, /blob bytes for scripts\/generate-manifests\.mjs/);
      return true;
    },
  );
});

test("sha-only source trees match the committed listing after those blobs load", async () => {
  const sourceFiles = new Map([["README.md", { mode: "100644", blobSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }]]);
  const blobs = new Map();
  for (const relativePath of ["scripts/generate-manifests.mjs", ".claude-plugin/marketplace.json"]) {
    const bytes = execFileSync("git", ["show", `HEAD^:${relativePath}`], { cwd: ROOT, encoding: "buffer" });
    const blobSha = gitBlobSha(bytes);
    blobs.set(blobSha, bytes);
    sourceFiles.set(relativePath, { mode: "100644", blobSha });
  }
  await hydrateAcceptedListing(sourceFiles, async (blobSha) => blobs.get(blobSha));
  const desired = desiredTree({ sourceFiles, destFiles: new Map() });
  assert.equal(desired.get("README.md").blobSha, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  assert.equal(desired.get("README.md").bytes, undefined);
  for (const relativePath of ["scripts/generate-manifests.mjs", ".claude-plugin/marketplace.json"]) {
    assert.equal(desired.get(relativePath).blobSha, gitBlobSha(readFileSync(path.join(ROOT, relativePath))));
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
