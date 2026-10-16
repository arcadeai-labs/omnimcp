#!/usr/bin/env node
// @ts-check
// Telemetry hook for each client in hook-hosts.mjs with a `telemetry` entry.
// Sends the usage events described in docs/telemetry.md. Always exit 0.

import { TELEMETRY_ENABLED } from "./telemetry-config.mjs";

if (!TELEMETRY_ENABLED) process.exit(0);

const { hostFromArgs, readInput } = await import("./hook-hosts.mjs");
const { loadTelemetryAdapter } = await import("./telemetry-adapter.mjs");
const { runTelemetry } = await import("./telemetry-run.mjs");

try {
  const adapterHost = hostFromArgs(process.argv)?.telemetry;
  if (!adapterHost) {
    process.exit(0);
  }
  const adapter = await loadTelemetryAdapter(adapterHost);
  const input = await readInput();
  await runTelemetry({ input, adapter, enabled: true });
} catch {
  // Telemetry must never affect the session.
}

process.exit(0);
