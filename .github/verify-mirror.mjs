#!/usr/bin/env node
// Run from the trusted destination base, never from the PR checkout.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ACCEPTED_LISTING_PATHS, SYNC_CONTRACT, desiredTree, diffTrees, hydrateAcceptedListing } from "./legacy-projection.mjs";

const SHA = /^[0-9a-f]{40}$/;
const assertSha = (sha) => { if (!SHA.test(sha ?? "")) throw new Error("expected an immutable Git SHA"); };

export const sourceProvenance = (message) => {
  const lines = message.split("\n").filter((line) => line.startsWith("Source-SHA: "));
  if (lines.length !== 1 || !SHA.test(lines[0].slice(12))) throw new Error("Not a mirror snapshot: missing or ambiguous Source-SHA; human changes need explicit review in the canonical repository or a separately reviewed control change.");
  return lines[0].slice(12);
};

export const verifyProjection = ({ sourceFiles, candidateFiles, baseFiles }) => {
  for (const path of Object.values(SYNC_CONTRACT.replacements)) {
    if (!sourceFiles.has(path)) throw new Error(`canonical source is not ready for mirror integrity: missing ${path}`);
  }
  const expected = desiredTree({ sourceFiles, destFiles: baseFiles });
  const diff = diffTrees(candidateFiles, expected);
  if (!diff.noop) throw new Error(`Mirror differs from trusted canonical projection: ${JSON.stringify(diff)}`);
  return { files: expected.size, differences: 0 };
};

const git = (repo, args, encoding = "utf8") => {
  const result = spawnSync("git", args, { cwd: repo, encoding, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
  return result.stdout;
};
const localTree = (repo, sha) => {
  const tree = new Map(git(repo, ["ls-tree", "-r", "-z", sha]).split("\0").filter(Boolean).map((record) => {
  const separator = record.indexOf("\t");
  if (separator < 0) throw new Error("malformed Git tree record");
  const meta = record.slice(0, separator);
  const path = record.slice(separator + 1);
  const [mode, type, blobSha] = meta.split(" ");
  if (type !== "blob" || !["100644", "100755"].includes(mode)) throw new Error(`unsupported mirror entry ${path}`);
  return [path, { mode, blobSha }];
  }));
  for (const path of ACCEPTED_LISTING_PATHS) {
    const entry = tree.get(path);
    if (!entry) continue;
    entry.bytes = git(repo, ["cat-file", "blob", entry.blobSha], "buffer");
  }
  return tree;
};

export const createGithubReader = ({ token, fetch = globalThis.fetch }) => {
  const api = async (path) => {
    const response = await fetch(`https://api.github.com${path}`, { headers: {
      accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-github-api-version": "2022-11-28",
    } });
    if (!response.ok) throw new Error(`GitHub read failed (${response.status})`);
    return response.json();
  };
  return {
    async main() {
      const ref = await api(`/repos/${SYNC_CONTRACT.sourceRepo}/git/ref/heads/${SYNC_CONTRACT.sourceBranch}`);
      return ref.object.sha;
    },
    async commit(repo, sha) { assertSha(sha); return api(`/repos/${repo}/git/commits/${sha}`); },
    async tree(repo, sha) {
      const commit = await this.commit(repo, sha);
      const tree = await api(`/repos/${repo}/git/trees/${commit.tree.sha}?recursive=1`);
      if (tree.truncated) throw new Error("GitHub tree is truncated");
      const entries = new Map(tree.tree.filter((item) => item.type !== "tree").map((item) => {
        if (item.type !== "blob" || !["100644", "100755"].includes(item.mode)) throw new Error(`unsupported mirror entry ${item.path}`);
        return [item.path, { mode: item.mode, blobSha: item.sha }];
      }));
      await hydrateAcceptedListing(entries, async (blobSha) => {
        const blob = await api(`/repos/${repo}/git/blobs/${blobSha}`);
        if (blob.encoding !== "base64") throw new Error(`unexpected blob encoding for ${blobSha}`);
        return Buffer.from(blob.content, "base64");
      });
      return entries;
    },
  };
};

// The expected source comes from the fixed canonical repository's main ref.
// Candidate metadata can assert that SHA but cannot select a different source,
// exclusion list, checker, repository, or workflow policy.
export const verifyGithubMirror = async ({ event, repository, reader }) => {
  if (repository !== SYNC_CONTRACT.destRepo || event.pull_request?.base?.repo?.full_name !== SYNC_CONTRACT.destRepo || event.pull_request.base.ref !== SYNC_CONTRACT.destBaseBranch) {
    throw new Error("integrity check only accepts PRs into the fixed legacy repository main");
  }
  const head = event.pull_request.head.sha;
  const base = event.pull_request.base.sha;
  assertSha(head); assertSha(base);
  const canonical = await reader.main(); assertSha(canonical);
  const commit = await reader.commit(SYNC_CONTRACT.destRepo, head);
  if (sourceProvenance(commit.message) !== canonical) throw new Error("Mirror source is not current trusted canonical main; refresh the mirror rather than changing its manifest.");
  const [sourceFiles, candidateFiles, baseFiles] = await Promise.all([
    reader.tree(SYNC_CONTRACT.sourceRepo, canonical), reader.tree(SYNC_CONTRACT.destRepo, head), reader.tree(SYNC_CONTRACT.destRepo, base),
  ]);
  const result = verifyProjection({ sourceFiles, candidateFiles, baseFiles });
  if (await reader.main() !== canonical) throw new Error("canonical main advanced during verification; rerun against the new source");
  return { ...result, sourceSha: canonical, head, base };
};

const main = async () => {
  if (process.argv.includes("--github")) {
    if (process.env.GITHUB_EVENT_NAME !== "pull_request_target") throw new Error("run the checker from the trusted base workflow");
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    console.log(JSON.stringify(await verifyGithubMirror({ event, repository: process.env.GITHUB_REPOSITORY, reader: createGithubReader({ token: process.env.GH_TOKEN }) }), null, 2));
    return;
  }
  // Explicit local review only. These operator-provided pins are never used
  // by the live workflow; unmerged bootstrap candidates require this review.
  const args = process.argv.slice(2);
  const value = (key) => { const i = args.indexOf(key); if (i < 0 || !args[i + 1]) throw new Error(`missing ${key}`); return args[i + 1]; };
  const source = value("--source"); const dest = value("--dest");
  const sourceSha = value("--source-sha"); const head = value("--head"); const base = value("--base");
  for (const sha of [sourceSha, head, base]) assertSha(sha);
  const commit = git(dest, ["show", "-s", "--format=%B", head]);
  if (sourceProvenance(commit) !== sourceSha) throw new Error("head provenance differs from the operator's trusted source pin");
  console.log(JSON.stringify({ ...verifyProjection({ sourceFiles: localTree(source, sourceSha), candidateFiles: localTree(dest, head), baseFiles: localTree(dest, base) }), sourceSha, head, base, trust: "local operator pins; not a live source approval" }, null, 2));
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
