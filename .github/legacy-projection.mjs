import { createHash } from "node:crypto";

/** Paths and branches the mirror is allowed to touch. */
export const SYNC_CONTRACT = {
  sourceRepo: "ArcadeAI/arcade-plugin",
  destRepo: "arcadeai-labs/omnimcp",
  sourceBranch: "main",
  destBaseBranch: "main",
  syncBranch: "sync/canonical-main",
  // Present in the canonical tree, omitted from the legacy tree.
  exclude: [
    ".github/workflows/",
    "scripts/sync-legacy.mjs",
    "scripts/legacy-projection.mjs",
    "scripts/verify-mirror.mjs",
    "test/sync-legacy.test.mjs",
    "test/mirror-integrity.test.mjs",
    "sync/",
    "docs/migration/",
  ],
  replacements: {
    ".github/workflows/check.yml": "sync/destination-check.yml",
    ".github/legacy-projection.mjs": "scripts/legacy-projection.mjs",
    ".github/verify-mirror.mjs": "scripts/verify-mirror.mjs",
  },
  // Destination-only file. The mirror must not delete or replace it.
  preserve: ["docs/migration/repository-controls.md"],
};

/** Git blob id for `bytes`, matching `git hash-object`. */
export const gitBlobSha = (bytes) => {
  const hash = createHash("sha1");
  hash.update(`blob ${bytes.length}\0`);
  hash.update(bytes);
  return hash.digest("hex");
};

/** @param {string} mode @param {Buffer | string} bytes */
export const entryFromBytes = (mode, bytes) => {
  if (mode === "120000" || mode === "160000") {
    throw new Error(`refusing to mirror mode ${mode}`);
  }
  const normalized = mode === "100755" ? "100755" : "100644";
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return { mode: normalized, bytes: buffer, blobSha: gitBlobSha(buffer) };
};

/** True when `path` is a canonical path that must not be copied. */
export const isExcluded = (path, exclude = SYNC_CONTRACT.exclude) =>
  exclude.some((rule) => {
    if (rule.endsWith("/")) return path === rule.slice(0, -1) || path.startsWith(rule);
    return path === rule;
  });

/** True when `path` is a destination-only path the mirror keeps. */
export const isPreserved = (path, preserve = SYNC_CONTRACT.preserve) => preserve.includes(path);

/** Stable notice kept only in the legacy tree. */
export const repositoryControlsDocument = (contract = SYNC_CONTRACT) =>
  [
    "# Repository controls",
    "",
    `This tree mirrors \`${contract.sourceRepo}\`. Package files match that`,
    "repository at the Source-SHA recorded on the sync commit and pull request.",
    "Canonical commits are not imported.",
    "",
    "These canonical paths are intentionally absent:",
    "",
    ...contract.exclude.map((path) => `- \`${path}\``),
    "",
    "Destination controls are projected from these canonical templates:",
    "",
    ...Object.entries(contract.replacements ?? {}).map(([destination, source]) => `- \`${source}\` -> \`${destination}\``),
    "",
    "This file is destination-only. Sync keeps it and does not replace it.",
    "",
    "The pre-migration tree used the Apache-2.0 license. Those obsolete paths",
    "are removed when the canonical tree is copied. Their notices remain in git",
    "history. Files copied from the canonical package keep that package's MIT notice.",
    "",
    "This tree does not change the existing legacy listing.",
    "",
  ].join("\n");

/**
 * The tree that should be committed on the legacy sync branch.
 * `sourceFiles` and `destFiles` are maps of repo-relative path to entries.
 */
export const desiredTree = ({ sourceFiles, destFiles, contract = SYNC_CONTRACT }) => {
  const desired = new Map();
  for (const [path, entry] of sourceFiles) {
    if (isExcluded(path, contract.exclude) || isPreserved(path, contract.preserve) || path in (contract.replacements ?? {})) continue;
    desired.set(path, entry);
  }
  for (const [destination, source] of Object.entries(contract.replacements ?? {})) {
    if (sourceFiles.has(source)) desired.set(destination, sourceFiles.get(source));
  }
  const template = entryFromBytes("100644", repositoryControlsDocument(contract));
  for (const path of contract.preserve) {
    desired.set(path, destFiles.get(path) ?? template);
  }
  return desired;
};

/** Additions, content changes, and deletions between two entry maps. */
export const diffTrees = (current, desired) => {
  const additions = [];
  const changes = [];
  const deletions = [];
  for (const [path, entry] of desired) {
    const before = current.get(path);
    if (!before) additions.push(path);
    else if (before.blobSha !== entry.blobSha || before.mode !== entry.mode) changes.push(path);
  }
  for (const path of current.keys()) {
    if (!desired.has(path)) deletions.push(path);
  }
  for (const list of [additions, changes, deletions]) list.sort();
  return {
    additions,
    changes,
    deletions,
    noop: additions.length + changes.length + deletions.length === 0,
  };
};
