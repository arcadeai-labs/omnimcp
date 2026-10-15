#!/usr/bin/env node
// @ts-check
// Detached sender started by telemetry.mjs. Posts one event to PostHog, no
// retries. Always exit 0.

import { EVENT_ENV, POSTHOG_HOST, POSTHOG_KEY } from "./telemetry-config.mjs";

try {
  const { event, distinct_id, properties } = JSON.parse(process.env[EVENT_ENV] ?? "");
  await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id,
      properties,
      timestamp: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(1000),
  });
} catch {
  // Telemetry is best effort.
}

process.exit(0);
