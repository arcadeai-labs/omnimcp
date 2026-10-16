// @ts-check
/** Opt-out checks and the shared telemetry hook body. Never throws. */

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scopeForInput } from "./hook-scope.mjs";
import { ARCADE_USED_FILE, EVENT_ENV, OPT_OUT_ENV, TELEMETRY_ENABLED } from "./telemetry-config.mjs";
import { buildEvent, isArcadeCall } from "./telemetry-events.mjs";

/** @typedef {import("./telemetry-adapter.mjs").TelemetryAdapter} TelemetryAdapter */

const SENDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "telemetry-send.mjs",
);

const OFF_VALUES = ["0", "false", "off", "no"];

const isSet = (/** @type {string} */ value) => value !== "" && !OFF_VALUES.includes(value.toLowerCase());

/**
 * A switch with `anyValue` is on for any non-empty value, even "0" or "false",
 * because that is how Claude Code reads its own switches.
 * @param {{ name: string, anyValue: boolean }[]} optOutSwitches
 * @param {NodeJS.ProcessEnv} env
 */
export const isOptedOut = (optOutSwitches, env = process.env) => {
  if (OFF_VALUES.includes((env[OPT_OUT_ENV] ?? "").toLowerCase())) return true;
  if (isSet(env.DO_NOT_TRACK ?? "")) return true;
  return optOutSwitches.some(({ name, anyValue }) => {
    const value = env[name] ?? "";
    return anyValue ? value !== "" : isSet(value);
  });
};

const readArcadeUsed = (/** @type {string} */ dir) => {
  try {
    return readFileSync(path.join(dir, ARCADE_USED_FILE), "utf8").trim() === "true";
  } catch {
    return false;
  }
};

// Bash hook entries pass `--cli <name>`; buildEvent checks the value.
const cliFromArgs = (/** @type {string[]} */ argv) => {
  const flag = argv.indexOf("--cli");
  return flag === -1 ? undefined : argv[flag + 1];
};

const markArcadeUsed = (/** @type {string} */ dir) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, ARCADE_USED_FILE), "true", { mode: 0o600 });
};

/**
 * Clears prompt scope on session start when telemetry is active and not opted out.
 * @param {object} options
 * @param {TelemetryAdapter} options.adapter
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {Record<string, any>} [options.input]
 * @param {boolean} [options.enabled]
 */
export const clearSessionScope = ({
  adapter,
  env = process.env,
  input = {},
  enabled = false,
}) => {
  try {
    if (!enabled && !TELEMETRY_ENABLED) return;
    if (isOptedOut(adapter.optOutSwitches, env)) return;
    const dir = env[adapter.dataVariable];
    if (!dir || !path.isAbsolute(dir)) return;
    scopeForInput(
      { ...adapter.normalize(input), hook_event_name: "SessionStart" },
      { host: adapter.host, requiresTurn: adapter.requiresTurn, dir },
    );
  } catch {
    // Scope clearing must never affect the session.
  }
};

const defaultSend = (/** @type {object} */ event, env = process.env) => {
  // Claude Code kills hook processes when the session exits, so the network
  // call runs in a detached child that can outlive this hook. The event goes
  // in an environment variable, not an argument, because other users on the
  // machine can read a process's arguments but not its environment.
  const child = spawn(process.execPath, [SENDER], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: { ...env, [EVENT_ENV]: JSON.stringify(event) },
  });
  child.on("error", () => {});
  child.unref();
};

/**
 * @param {object} options
 * @param {Record<string, any>} options.input Raw hook stdin.
 * @param {TelemetryAdapter} options.adapter
 * @param {string[]} [options.argv]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {number} [options.now]
 * @param {boolean} [options.enabled] When true, runs even if TELEMETRY_ENABLED is false (tests).
 * @param {(event: object) => void} [options.send]
 */
export const runTelemetry = async ({
  input,
  adapter,
  argv = process.argv,
  env = process.env,
  now = Date.now(),
  enabled = false,
  send = (event) => defaultSend(event, env),
}) => {
  try {
    if (!enabled && !TELEMETRY_ENABLED) return;
    // The client always sets this. Without an absolute data folder there is
    // nowhere to keep the arcade-used flag, so nothing is sent.
    const dir = env[adapter.dataVariable];
    if (!dir || !path.isAbsolute(dir)) return;
    if (isOptedOut(adapter.optOutSwitches, env)) return;
    const normalized = adapter.normalize(input ?? {});
    const { appWork } = scopeForInput(normalized, {
      host: adapter.host,
      requiresTurn: adapter.requiresTurn,
      dir,
      now,
    });

    const arcadeUsedBefore = readArcadeUsed(dir);
    const event = buildEvent(normalized, {
      adapter,
      os: process.platform,
      arcadeUsedBefore,
      cli: cliFromArgs(argv),
      appWork,
    });
    if (!event) return;
    if (!arcadeUsedBefore && isArcadeCall(event)) markArcadeUsed(dir);
    send(event);
  } catch {
    // Telemetry must never affect the session.
  }
};
