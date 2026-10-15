#!/usr/bin/env node
// Adds the Arcade routing rules at session start. Always exits 0.

import { hostFromArgs, printContext, readInput } from "./hook-hosts.mjs";
import { TELEMETRY_ENABLED } from "./telemetry-config.mjs";
import { loadTelemetryAdapter } from "./telemetry-adapter.mjs";
import { clearSessionScope } from "./telemetry-run.mjs";
import { SESSION_CONTEXT } from "./routing-guidance.mjs";

const host = hostFromArgs(process.argv);
try {
  if (TELEMETRY_ENABLED && host?.telemetry) {
    try {
      const adapter = await loadTelemetryAdapter(host.telemetry);
      const input = await readInput();
      clearSessionScope({
        adapter,
        env: process.env,
        input,
        enabled: TELEMETRY_ENABLED,
      });
    } catch {
      // Clearing local scope must not suppress the routing context.
    }
  }
  if (host) printContext(host, "SessionStart", SESSION_CONTEXT);
} catch {
  // Never block session startup.
}
process.exit(0);
