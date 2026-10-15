#!/usr/bin/env node
// Adds a short routing reminder to user prompts. Always exits 0.

import { hostFromArgs, printContext, readInput } from "./hook-hosts.mjs";
import { shouldRemind } from "./prompt-filters.mjs";
import { PROMPT_REMINDER } from "./routing-guidance.mjs";

const host = hostFromArgs(process.argv);
try {
  const { prompt } = await readInput();
  if (host && shouldRemind(prompt)) printContext(host, "UserPromptSubmit", PROMPT_REMINDER);
} catch {
  // Never block a prompt.
}
process.exit(0);
