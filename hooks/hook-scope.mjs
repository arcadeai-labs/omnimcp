// @ts-check
/** Limits observations to app work in the current session and turn. */

import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isConfirmation, isTaskNotification } from "./prompt-filters.mjs";
import { classifyPrompt } from "./telemetry-classify.mjs";

export const SCOPE_TTL_MS = 30 * 60 * 1000;
export const SCOPE_DIRECTORY = "prompt-scope";
export const MAX_SCOPE_FILES = 256;

const hash = (/** @type {string} */ value) => createHash("sha256").update(value).digest("hex");
const turnHash = (/** @type {Record<string, any>} */ input) =>
  typeof input.prompt_id === "string" && input.prompt_id !== "" ? hash(input.prompt_id) : undefined;

/** @typedef {{ relevant: boolean, expiresAt: number, turn?: string }} ScopeState */

/**
 * Pure prompt decision; confirmations keep the original app prompt's deadline.
 * @param {unknown} prompt
 * @param {ScopeState | null} previous
 * @param {number} now
 * @returns {ScopeState}
 */
export const classifyAppWork = (prompt, previous = null, now = Date.now()) => {
  const direct = classifyPrompt(prompt).couldUseArcade
    || (typeof prompt === "string" && /\barcade\b/i.test(prompt));
  if (direct) return { relevant: true, expiresAt: now + SCOPE_TTL_MS };
  if (previous?.relevant && previous.expiresAt > now && isConfirmation(prompt)) {
    return { relevant: true, expiresAt: previous.expiresAt };
  }
  return { relevant: false, expiresAt: now + SCOPE_TTL_MS };
};

const readState = (/** @type {string} */ file, /** @type {number} */ now) => {
  try {
    const state = JSON.parse(readFileSync(file, "utf8"));
    if (Object.keys(state).some((key) => !["relevant", "expiresAt", "turn"].includes(key))
      || typeof state.relevant !== "boolean" || !Number.isFinite(state.expiresAt)
      || state.expiresAt <= now || state.expiresAt > now + SCOPE_TTL_MS
      || (state.turn !== undefined && (typeof state.turn !== "string" || !/^[a-f0-9]{64}$/.test(state.turn)))) return null;
    return /** @type {ScopeState} */ (state);
  } catch {
    return null;
  }
};

const writeState = (/** @type {string} */ file, /** @type {ScopeState} */ state, /** @type {number} */ now) => {
  const dir = path.dirname(file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const files = readdirSync(dir).filter((name) => /^[a-f0-9]{64}\.json$/.test(name));
  const live = [];
  for (const name of files) {
    const entry = path.join(dir, name);
    if (!readState(entry, now)) rmSync(entry, { force: true });
    else live.push({ file: entry, modified: statSync(entry).mtimeMs });
  }
  live.sort((a, b) => a.modified - b.modified);
  for (const entry of live.slice(0, Math.max(0, live.length - MAX_SCOPE_FILES + 1))) {
    if (entry.file !== file) rmSync(entry.file, { force: true });
  }
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
};

/**
 * Whether this hook input is part of app work. Prompt hooks record the
 * decision; other hooks read it.
 * @param {Record<string, any>} input
 * @param {{ host: string, requiresTurn: boolean, dir?: string, now?: number }} options
 */
export const scopeForInput = (input, { host, requiresTurn, dir, now = Date.now() }) => {
  const fallback = { appWork: false };
  const promptHook = input.hook_event_name === "UserPromptSubmit";
  if (promptHook && isTaskNotification(input.prompt)) return fallback;
  const session = typeof input.session_id === "string" && input.session_id !== "" ? input.session_id : null;
  const file = dir && path.isAbsolute(dir) && session
    ? path.join(dir, SCOPE_DIRECTORY, `${hash(`${host}:${session}`)}.json`) : null;
  if (input.hook_event_name === "SessionStart") {
    // Claude Code also sends SessionStart after compacting a conversation. The
    // session and turn continue, so their scope does too.
    if (file && input.source !== "compact") rmSync(file, { force: true });
    return fallback;
  }
  const previous = file ? readState(file, now) : null;
  const turn = turnHash(input);
  if (!promptHook) {
    const matchesTurn = requiresTurn
      ? turn !== undefined && previous?.turn === turn
      : turn === undefined || previous?.turn === turn;
    const appWork = previous?.relevant === true && matchesTurn;
    return { appWork };
  }
  const state = turn && previous?.turn === turn
    ? previous : { ...classifyAppWork(input.prompt, previous, now), ...(turn ? { turn } : {}) };
  if (file) {
    try {
      writeState(file, state, now);
    } catch {
      // Remove stale relevance when a new prompt cannot be stored.
      try { rmSync(file, { force: true }); } catch {}
    }
  }
  return { appWork: state.relevant };
};
