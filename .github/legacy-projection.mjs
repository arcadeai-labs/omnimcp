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

/** Owner email on the Claude marketplace already accepted at destRepo. */
export const ACCEPTED_LISTING_OWNER_EMAIL = "support@arcade.dev";

const GENERATOR_PATH = "scripts/generate-manifests.mjs";
const MARKETPLACE_PATH = ".claude-plugin/marketplace.json";
/** Source paths whose bytes the listing patch must read. Integrity trees only carry mode and blobSha until these blobs are loaded. */
export const ACCEPTED_LISTING_PATHS = [GENERATOR_PATH, MARKETPLACE_PATH];
const GENERATOR_ROOT_LINE = 'const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");\n';
const GENERATOR_ROOT_PATCH = `${GENERATOR_ROOT_LINE}
// The accepted Claude marketplace for this plugin is arcadeai-labs/omnimcp.
// Keep its owner email when generating the catalog. The author URL still comes
// from plugin.json.
export const ACCEPTED_LISTING_OWNER_EMAIL = ${JSON.stringify(ACCEPTED_LISTING_OWNER_EMAIL)};
`;
const GENERATOR_OWNER_LINE = "        owner: author,";
const GENERATOR_OWNER_PATCH = "        owner: { ...author, email: ACCEPTED_LISTING_OWNER_EMAIL },";

/**
 * Load blob contents for the listing paths. `git ls-tree` and the GitHub trees
 * API only provide mode and blobSha; the patch cannot run until those blobs
 * are read.
 * @param {Map<string, { mode: string, blobSha: string, bytes?: Buffer }>} tree
 * @param {(blobSha: string) => Buffer | Promise<Buffer>} readBlob
 */
export const hydrateAcceptedListing = async (tree, readBlob) => {
  await Promise.all(ACCEPTED_LISTING_PATHS.map(async (path) => {
    const entry = tree.get(path);
    if (!entry || Buffer.isBuffer(entry.bytes)) return;
    const bytes = await readBlob(entry.blobSha);
    if (!Buffer.isBuffer(bytes)) throw new Error(`blob reader returned no bytes for ${path}`);
    entry.bytes = bytes;
  }));
  return tree;
};

const listingBytes = (path, entry) => {
  if (!Buffer.isBuffer(entry?.bytes)) {
    throw new Error(`listing patch requires blob bytes for ${path}; load ${path} before projection`);
  }
  return entry.bytes.toString("utf8");
};

/**
 * The accepted listing keeps marketplace name, plugin name, and source "./".
 * This adds only the owner email the canonical generator omits.
 * @param {string} path
 * @param {{ mode: string, bytes?: Buffer, blobSha: string }} entry
 */
export const applyAcceptedListing = (path, entry) => {
  if (path === GENERATOR_PATH) {
    const source = listingBytes(path, entry);
    if (source.includes(GENERATOR_OWNER_PATCH)) return entry;
    if (!source.includes(GENERATOR_ROOT_LINE) || !source.includes(GENERATOR_OWNER_LINE)) {
      throw new Error("canonical generator no longer has the marketplace owner line the listing patch expects");
    }
    const patched = source
      .replace(GENERATOR_ROOT_LINE, GENERATOR_ROOT_PATCH)
      .replace(GENERATOR_OWNER_LINE, GENERATOR_OWNER_PATCH);
    return entryFromBytes(entry.mode, patched);
  }
  if (path === MARKETPLACE_PATH) {
    const manifest = JSON.parse(listingBytes(path, entry));
    manifest.owner = { ...manifest.owner, email: ACCEPTED_LISTING_OWNER_EMAIL };
    return entryFromBytes(entry.mode, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return entry;
};

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
    "This tree does not change the existing legacy listing. The Claude",
    "marketplace stays `arcade` with plugin `arcade` at `source: \"./\"`, and",
    `the marketplace owner keeps \`${ACCEPTED_LISTING_OWNER_EMAIL}\`.`,
    "Existing and hub installs use this repository. New installs use",
    `\`${contract.sourceRepo}\`. Do not add both in one Claude profile: they`,
    "share the marketplace name `arcade`.",
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
    desired.set(path, applyAcceptedListing(path, entry));
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
