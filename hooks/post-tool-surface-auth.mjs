#!/usr/bin/env node
// PostToolUse hook (matched to mcp__arcade__Arcade_UseTool): if the tool result
// contains an OAuth authorization URL, surface it clearly so it isn't buried in
// the result. Always exits 0 so it can never block tool flow.

import { readFileSync } from "node:fs";

try {
  const raw = readFileSync(0, "utf8");
  const event = raw ? JSON.parse(raw) : {};

  // tool_response shape varies; stringify whatever we got and scan for a URL.
  const haystack =
    typeof event.tool_response === "string"
      ? event.tool_response
      : JSON.stringify(event.tool_response ?? "");

  const match = haystack.match(
    /https?:\/\/[^\s"'<>)]*(?:oauth|authoriz|connect|consent)[^\s"'<>)]*/i,
  );

  if (match) {
    const url = match[0];
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext:
            "Omni needs authorization to finish this action. Present this link " +
            "to the user, then retry the tool call after they approve it " +
            "(do not loop on auth):\n" +
            url,
        },
      }),
    );
  }
} catch {
  // Swallow everything: a hook must never break the tool-use flow.
}

process.exit(0);
