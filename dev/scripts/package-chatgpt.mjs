#!/usr/bin/env node
// Builds the ZIP to upload in OpenAI's plugin portal (ChatGPT and Codex
// directory): dist/arcade-chatgpt-<version>.zip.
//
// The archive holds only the portable Agent Plugin, with plugin.json at the
// ZIP root: plugin.json, mcp.json, skills/, the listing images, and LICENSE.
// OpenAI reads the listing from extensions.com.openai in plugin.json. The other
// clients' folders (.claude-plugin/, .cursor-plugin/, com.github.copilot/) and
// the hook scripts stay out: plugin ZIPs with lifecycle hooks can't be
// submitted yet, and a second manifest folder would only add ambiguity.
//
// Usage: node dev/scripts/package-chatgpt.mjs [--out <dir>]

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Final directory submission rules from OpenAI's "Plugin submission errors"
// page (https://developers.openai.com/plugins/deploy/submission-errors) and
// the listing field reference in "Upload and submit your plugin"
// (https://developers.openai.com/plugins/deploy/submission). Package upload
// accepts longer draft text; these are the limits a listing must meet to be
// submitted.
export const LISTING_LIMITS = {
  displayName: 30,
  shortDescription: 30,
  longDescription: 4000,
  developerName: 80,
};
export const LISTING_CATEGORIES = [
  "Productivity", "Creativity", "Developer Tools", "Business & Operations", "Data & Analytics",
  "Communication", "Education & Research", "Security", "Finance", "Healthcare", "Travel",
  "Entertainment", "Other",
];
export const LISTING_URLS = ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"];
export const MAX_URL_LENGTH = 1024;
export const MAX_DEFAULT_PROMPTS = 3;
export const MAX_DEFAULT_PROMPT_LENGTH = 128;

const isMultiline = (value) => /[\r\n\u2028\u2029]/.test(value);

/** Returns every problem the portal would reject in the OpenAI listing. */
export const listingProblems = (listing) => {
  const problems = [];
  for (const [key, max] of Object.entries(LISTING_LIMITS)) {
    const value = listing[key];
    if (typeof value !== "string" || value.trim() === "") {
      problems.push(`${key} is required`);
      continue;
    }
    if (value.length > max) problems.push(`${key} is ${value.length} characters; the limit is ${max}`);
    if (key !== "longDescription" && isMultiline(value)) problems.push(`${key} must be one line`);
  }
  if (!LISTING_CATEGORIES.includes(listing.category)) {
    problems.push(`category must be one of: ${LISTING_CATEGORIES.join(", ")}`);
  }
  if (!listing.logo) problems.push("logo is required");
  for (const key of LISTING_URLS) {
    const value = listing[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || !value.startsWith("https://") || value.length > MAX_URL_LENGTH) {
      problems.push(`${key} must be an HTTPS URL of at most ${MAX_URL_LENGTH} characters`);
    }
  }
  // defaultPrompt takes one string or a list of strings.
  const prompts = [listing.defaultPrompt ?? []].flat();
  if (prompts.length > MAX_DEFAULT_PROMPTS) problems.push(`defaultPrompt has ${prompts.length} entries; the limit is ${MAX_DEFAULT_PROMPTS}`);
  if (new Set(prompts.map((prompt) => prompt.normalize("NFKC").replace(/\s+/g, " ").trim())).size !== prompts.length) {
    problems.push("defaultPrompt entries must be unique");
  }
  for (const prompt of prompts) {
    if (prompt.trim() === "" || prompt.length > MAX_DEFAULT_PROMPT_LENGTH || isMultiline(prompt)) {
      problems.push(`defaultPrompt entry must be one non-empty line of at most ${MAX_DEFAULT_PROMPT_LENGTH} characters: ${prompt}`);
    }
    if (/(^|\s)@\w/.test(prompt)) problems.push(`defaultPrompt entry must not @mention an MCP server: ${prompt}`);
  }
  return problems;
};

const listFiles = (root, dir) =>
  readdirSync(join(root, dir), { withFileTypes: true })
    // Skip dotfiles such as .DS_Store that a local checkout may hold.
    .filter((entry) => !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      return entry.isDirectory() ? listFiles(root, path) : [path];
    });

/** The paths, relative to the repo root, that go into the ZIP. */
export const packageFiles = (root = ROOT) => {
  const plugin = JSON.parse(readFileSync(join(root, "plugin.json"), "utf8"));
  const { logo, composerIcon } = plugin.extensions["com.openai"].interface;
  const images = [logo, composerIcon].filter(Boolean).map((path) => path.replace(/^\.\//, ""));
  return [...new Set(["plugin.json", "mcp.json", "LICENSE", ...listFiles(root, "skills"), ...images])];
};

// A fixed timestamp (1980-01-01 local time, the earliest a ZIP can store),
// fixed permissions, and a fixed entry order keep the archive byte-for-byte the
// same for the same sources.
const ENTRY_OPTIONS = { level: 9, mtime: new Date(1980, 0, 1), os: 3, attrs: (0o100644 << 16) >>> 0 };

/** Writes the ZIP and returns its path and the paths inside it. */
export const packageChatGPT = ({ root = ROOT, outDir = join(root, "dist") } = {}) => {
  const plugin = JSON.parse(readFileSync(join(root, "plugin.json"), "utf8"));
  const version = readFileSync(join(root, "VERSION"), "utf8").trim();
  if (plugin.version !== version) {
    throw new Error(`plugin.json version ${plugin.version} does not match VERSION ${version}`);
  }
  const listing = plugin.extensions?.["com.openai"]?.interface;
  if (!listing) throw new Error("plugin.json has no extensions.com.openai.interface listing");
  const problems = listingProblems(listing);
  if (problems.length > 0) {
    throw new Error(`plugin.json extensions.com.openai.interface:\n- ${problems.join("\n- ")}`);
  }

  const files = packageFiles(root);
  for (const file of files) {
    if (!statSync(join(root, file), { throwIfNoEntry: false })?.isFile()) throw new Error(`${file} is missing`);
  }
  const archive = zipSync(Object.fromEntries(files.map((name) => [name, [readFileSync(join(root, name)), ENTRY_OPTIONS]])));
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${plugin.name}-chatgpt-${version}.zip`);
  writeFileSync(path, archive);
  return { path, files };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outIndex = process.argv.indexOf("--out");
  try {
    if (outIndex !== -1 && !process.argv[outIndex + 1]) throw new Error("--out needs a directory");
    const outDir = outIndex === -1 ? undefined : resolve(process.argv[outIndex + 1]);
    const { path, files } = packageChatGPT({ outDir });
    console.log(`${path} (${files.length} files)`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
