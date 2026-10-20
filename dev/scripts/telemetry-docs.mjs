// @ts-check
/** Writes the event tables in docs/telemetry.md from hooks/telemetry-contract.mjs. */

import { COMMON_PROPERTIES, EVENTS, SERVICE_CATEGORIES } from "../../hooks/telemetry-contract.mjs";

export const TELEMETRY_DOC = "docs/telemetry.md";
export const TELEMETRY_BLOCK_BEGIN =
  "<!-- BEGIN generated from hooks/telemetry-contract.mjs by `npm run generate`; edit that file, not this block -->";
export const TELEMETRY_BLOCK_END = "<!-- END generated telemetry tables -->";

const code = (/** @type {string} */ text) => `\`${text}\``;

export const buildTelemetryTables = () => {
  const common = [
    "| Property | Value |",
    "| --- | --- |",
    "| `distinct_id` | the same value as `session` |",
    ...Object.entries(COMMON_PROPERTIES).map(([key, { doc }]) => `| ${code(key)} | ${doc} |`),
  ];
  const events = [
    "| Event | When | Extra properties |",
    "| --- | --- | --- |",
    ...Object.entries(EVENTS).map(([name, spec]) => {
      const when = spec.when ? `${spec.hook}, ${spec.when}` : spec.hook;
      const extras = Object.entries(spec.properties)
        .map(([key, { doc }]) => `${code(key)}: ${doc}.`)
        .join(" ");
      return `| ${code(name)} | ${when} | ${extras} |`;
    }),
  ];
  return [
    "Every event has these properties:",
    "",
    ...common,
    "",
    "Events and their extra properties:",
    "",
    ...events,
    "",
    `Service categories: ${SERVICE_CATEGORIES.map(code).join(", ")}.`,
  ].join("\n");
};

/**
 * Replaces the generated block in docs/telemetry.md.
 * @param {string} text
 */
export const fillTelemetryTables = (text) => {
  const begin = text.indexOf(TELEMETRY_BLOCK_BEGIN);
  const end = text.indexOf(TELEMETRY_BLOCK_END);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(`${TELEMETRY_DOC} is missing the generated telemetry block markers`);
  }
  return (
    text.slice(0, begin + TELEMETRY_BLOCK_BEGIN.length) +
    `\n${buildTelemetryTables()}\n` +
    text.slice(end)
  );
};
