#!/usr/bin/env node
// Adds the Arcade routing rules at session start. Always exits 0.

import { hostFromArgs, printContext } from "./hook-hosts.mjs";
import { SESSION_CONTEXT } from "./routing-guidance.mjs";

const host = hostFromArgs(process.argv);
try {
  if (host) printContext(host, "SessionStart", SESSION_CONTEXT);
} catch {
  // Never block session startup.
}
process.exit(0);
