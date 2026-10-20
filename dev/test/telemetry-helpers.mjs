// @ts-check
/**
 * Shared helpers for telemetry foundation tests. API kept stable for slices B/C.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { eventSchema } from "../../hooks/telemetry-contract.mjs";
import { EVENT_ENV, PLUGIN_VERSION } from "../../hooks/telemetry-config.mjs";
import { buildEvent } from "../../hooks/telemetry-events.mjs";
import { runTelemetry } from "../../hooks/telemetry-run.mjs";
import { ROOT } from "./helpers.mjs";

// An inherited opt-out, destination, plugin root or data dir would make a
// silence test pass for the wrong reason or send somewhere other than its server.
const TELEMETRY_ENV_BLOCKLIST = [
  "ARCADE_PLUGIN_TELEMETRY",
  "ARCADE_PLUGIN_TELEMETRY_HOST",
  "DO_NOT_TRACK",
  "DISABLE_TELEMETRY",
  "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
  "COPILOT_OFFLINE",
  "CLAUDE_PLUGIN_DATA",
  "COPILOT_PLUGIN_DATA",
  "PLUGIN_ROOT",
];

/**
 * process.env without inherited opt-outs, telemetry destination, plugin root
 * or data dirs, plus `overrides`.
 * @param {NodeJS.ProcessEnv} [overrides]
 */
export const hookEnv = (overrides = {}) => {
  const env = { ...process.env };
  for (const key of TELEMETRY_ENV_BLOCKLIST) delete env[key];
  return { ...env, ...overrides };
};

/** @type {string[]} */
const tempDataDirs = [];
// Registered at load so it runs after the whole file; `after` inside a test runs after that test only.
after(() => {
  for (const dir of tempDataDirs) rmSync(dir, { recursive: true, force: true });
  tempDataDirs.length = 0;
});

/** Absolute path of a fresh temp directory; removed after the test run finishes. */
export const tempDataDir = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "arcade-telemetry-"));
  tempDataDirs.push(dir);
  return dir;
};

/**
 * @param {import("../../hooks/telemetry-adapter.mjs").TelemetryAdapter} adapter
 * @param {string | null} dataDir
 * @param {NodeJS.ProcessEnv} overrides
 */
const captureEnv = (adapter, dataDir, overrides) =>
  hookEnv({ ...(dataDir === null ? {} : { [adapter.dataVariable]: dataDir }), ...overrides });

/**
 * @param {object} options
 * @param {import("../../hooks/telemetry-adapter.mjs").TelemetryAdapter} options.adapter
 * @param {Record<string, any>} options.input
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {string[]} [options.argv]
 * @param {string | null} [options.dataDir]
 * @param {number} [options.now]
 * @returns {Promise<{ sent: object[], dataDir: string | null }>}
 */
export const captureTelemetry = async ({
  adapter,
  input,
  env: envOverrides = {},
  argv = [],
  dataDir,
  now,
}) => {
  const resolvedDir = dataDir === undefined ? tempDataDir() : dataDir;
  /** @type {object[]} */
  const sent = [];
  await runTelemetry({
    input,
    adapter,
    argv,
    env: captureEnv(adapter, resolvedDir, envOverrides),
    enabled: true,
    now,
    send: (event) => sent.push(event),
  });
  return { sent, dataDir: resolvedDir };
};

const validateEvent = new Ajv2020({ allErrors: true }).compile(eventSchema());

/** @param {object} event */
export const assertMatchesContract = (event, label = JSON.stringify(event)) => {
  assert.equal(validateEvent(event), true, `${label}: ${JSON.stringify(validateEvent.errors)}`);
};

/**
 * @param {string} serialized
 * @param {RegExp | RegExp[]} patterns
 */
export const assertNoLeak = (serialized, patterns) => {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  for (const pattern of list) {
    assert.doesNotMatch(serialized, pattern, serialized);
  }
};

export const hash16 = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitForRequests = async (requests, count) => {
  const deadline = Date.now() + 3000;
  while (requests.length < count && Date.now() < deadline) await sleep(50);
};

export const startServer = async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      requests.push({ url: req.url, body });
      res.end("{}");
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const close = () => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  };
  return { url: `http://127.0.0.1:${server.address().port}`, requests, close };
};

/**
 * @param {import("../../hooks/telemetry-adapter.mjs").TelemetryAdapter} adapter
 */
export const telemetryEnv = (adapter, dataDir, serverUrl, extra = {}) => ({
  [adapter.dataVariable]: dataDir,
  ARCADE_PLUGIN_TELEMETRY_HOST: serverUrl,
  ARCADE_PLUGIN_TELEMETRY: "",
  DO_NOT_TRACK: "",
  FAKE_DISABLE_TELEMETRY: "",
  FAKE_OFFLINE: "",
  ...extra,
});

export const hookInput = (fields) => ({
  session_id: "raw-session-id-123",
  prompt_id: "raw-prompt-id-456",
  cwd: "/Users/someone/private-repo",
  ...fields,
});

/**
 * @param {import("../../hooks/telemetry-adapter.mjs").TelemetryAdapter} adapter
 */
export const expectedEvent = (event, extra, adapter, sessionId = "raw-session-id-123", promptId = "raw-prompt-id-456") => {
  const session = hash16(sessionId);
  const properties = {
    ...extra,
    host: adapter.host,
    plugin_version: PLUGIN_VERSION,
    telemetry_version: 2,
    os: "darwin",
    $process_person_profile: false,
    $geoip_disable: true,
    $ip: "0.0.0.0",
    arcade_used_before: false,
    session,
  };
  if (adapter.requiresTurn && typeof promptId === "string") {
    properties.turn = hash16(`${sessionId}:${promptId}`);
  }
  return { event, distinct_id: session, properties };
};

export const runTelemetryScript = (stdin, env, hostName = "claude-code", extraArgs = []) =>
  spawnSync(process.execPath, [path.join(ROOT, "hooks", "telemetry.mjs"), "--host", hostName, ...extraArgs], {
    input: stdin,
    encoding: "utf8",
    env: hookEnv(env),
  });

/**
 * Posts from the test process. The shipped sender does not contact a server.
 * @param {NodeJS.ProcessEnv} env
 */
export const sendWithNode = async (env) => {
  const payload = JSON.parse(env[EVENT_ENV] ?? "");
  const host = env.ARCADE_PLUGIN_TELEMETRY_HOST;
  if (!host || !payload?.event) return 1;
  await fetch(`${host}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: payload.event }),
  });
  return 0;
};

/**
 * Asserts nothing reached `server`, then sends the event `input` would build
 * through `send` with `env` and asserts it arrives, so the empty request list
 * can't come from a server that was down. This build's hooks don't read
 * `ARCADE_PLUGIN_TELEMETRY_HOST`, so this proves only that the test server
 * works; the data-directory checks and the `TELEMETRY_ENABLED` test catch an
 * open gate.
 * @param {object} options
 * @param {{ requests: { body: string }[] }} options.server
 * @param {import("../../hooks/telemetry-adapter.mjs").TelemetryAdapter} options.adapter
 * @param {Record<string, any>} options.input A hook input classified as app work.
 * @param {NodeJS.ProcessEnv} options.env
 * @param {(env: NodeJS.ProcessEnv) => Promise<number | null>} [options.send]
 */
export const assertSilentThenServerReachable = async ({ server, adapter, input, env, send = sendWithNode }) => {
  await sleep(300);
  assert.deepEqual(server.requests, []);
  const event = buildEvent(input, { adapter, os: "linux", arcadeUsedBefore: false, appWork: true });
  assert.ok(event);
  assert.equal(await send({ ...env, [EVENT_ENV]: JSON.stringify(event) }), 0);
  await waitForRequests(server.requests, 1);
  assert.equal(server.requests.length, 1);
  assert.equal(JSON.parse(server.requests[0].body).event, event.event);
};
