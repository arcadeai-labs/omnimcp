// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildTelemetryTables,
  fillTelemetryTables,
  TELEMETRY_BLOCK_BEGIN,
  TELEMETRY_BLOCK_END,
} from "../scripts/telemetry-docs.mjs";
import { COMMON_PROPERTIES, EVENTS } from "../../hooks/telemetry-contract.mjs";

test("buildTelemetryTables lists every contract event and common property", () => {
  const tables = buildTelemetryTables();
  for (const eventName of Object.keys(EVENTS)) {
    assert.ok(tables.includes(`| \`${eventName}\` |`), `tables must include a row for event "${eventName}"`);
  }
  for (const propName of Object.keys(COMMON_PROPERTIES)) {
    assert.ok(tables.includes(`| \`${propName}\` |`), `tables must include a row for common property "${propName}"`);
  }
  assert.match(tables, /Service categories:/);
});

test("fillTelemetryTables replaces only the generated block", () => {
  const tables = buildTelemetryTables();
  const source = [
    "before the block",
    "",
    TELEMETRY_BLOCK_BEGIN,
    "stale table row",
    TELEMETRY_BLOCK_END,
    "",
    "after the block",
    "",
  ].join("\n");
  const expected = [
    "before the block",
    "",
    TELEMETRY_BLOCK_BEGIN,
    tables,
    TELEMETRY_BLOCK_END,
    "",
    "after the block",
    "",
  ].join("\n");
  assert.equal(fillTelemetryTables(source), expected);
});
