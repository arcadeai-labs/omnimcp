// @ts-check
/** Telemetry settings. Collection is off, so this module has no key and reads no environment. */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOKS_DIR = path.dirname(fileURLToPath(import.meta.url));

// Off in every build until collection is separately approved. No environment
// variable or setting turns it on. While false, `npm run generate` writes no
// telemetry hooks and telemetry.mjs exits before reading its input.
export const TELEMETRY_ENABLED = false;

// Unused while collection is off. Kept so a later approved build has one place
// to set the destination, without reading the machine environment.
export const POSTHOG_HOST = "https://p.arcade.dev";

export const OPT_OUT_ENV = "ARCADE_PLUGIN_TELEMETRY";

// Holds "true" once an Arcade tool call has succeeded for this client plugin installation.
export const ARCADE_USED_FILE = "arcade-used";

// telemetry.mjs passes the event to telemetry-send.mjs in this variable.
export const EVENT_ENV = "ARCADE_PLUGIN_TELEMETRY_EVENT";

const readPluginVersion = () => {
  try {
    return readFileSync(path.join(HOOKS_DIR, "..", "VERSION"), "utf8").trim();
  } catch {
    return "unknown";
  }
};

export const PLUGIN_VERSION = readPluginVersion();
