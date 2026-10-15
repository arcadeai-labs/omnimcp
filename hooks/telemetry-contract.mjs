// @ts-check
/**
 * Every telemetry event the plugin sends, every property on it, and the values
 * each property may take. telemetry-events.mjs sends nothing that isn't listed
 * here, `npm run generate` writes the tables in docs/telemetry.md from it, and
 * the tests check every built event against eventSchema().
 */

export const SERVICE_CATEGORIES = /** @type {const} */ ([
  "email",
  "calendar",
  "chat",
  "issues",
  "docs",
  "meetings",
  "crm",
  "code_hosting",
  "analytics",
  "storage",
]);

export const TELEMETRY_HOSTS = /** @type {const} */ (["claude-code", "copilot-cli"]);
export const OS_NAMES = /** @type {const} */ (["darwin", "linux", "win32", "other"]);
export const SERVERS = /** @type {const} */ (["arcade", "other_arcade", "other"]);
export const AGENTS = /** @type {const} */ (["arcade-operator"]);
export const OPERATOR_STATUSES = /** @type {const} */ ([
  "completed",
  "needs_auth",
  "needs_confirmation",
  "needs_clarification",
  "failed",
  "unknown",
]);
export const FAILURE_KINDS = /** @type {const} */ ([
  "auth_required",
  "session_expired",
  "unreachable",
  "timeout",
  "http_error",
  "interrupted",
  "tool_error",
]);
export const BUILTIN_TOOLS = /** @type {const} */ (["Bash", "WebFetch", "WebSearch"]);

// Programs that reach an outside service from Bash. A Bash call sends an event
// only when one of its commands starts with one of these.
export const BASH_CLIS = /** @type {const} */ (["gh", "glab", "curl", "wget", "http", "osascript"]);

/** @type {Record<string, typeof SERVICE_CATEGORIES[number]>} */
export const CLI_SERVICES = { gh: "code_hosting", glab: "code_hosting" };

// Tools every Arcade gateway exposes. Seeing one on another server means the
// model used a different Arcade connection than this plugin's.
export const GATEWAY_TOOLS = /** @type {const} */ ([
  "Arcade_ListApps",
  "Arcade_SelectTools",
  "Arcade_UseTool",
  "System_ManageAuthorization",
]);

// Arcade toolkit name (the part of a tool name before "_" or ".", lowercased)
// to its service category. Tool suffixes are never sent.
/** @type {Record<string, typeof SERVICE_CATEGORIES[number]>} */
export const TOOLKIT_SERVICES = {
  gmail: "email", outlookmail: "email",
  googlecalendar: "calendar", outlookcalendar: "calendar", microsoftoutlookcalendar: "calendar", calendly: "calendar",
  slack: "chat", discord: "chat", discordbot: "chat", microsoftteams: "chat",
  linear: "issues", jira: "issues", asana: "issues", clickup: "issues", trello: "issues",
  notion: "docs", googledocs: "docs", confluence: "docs",
  googlesheets: "docs", microsoftword: "docs", microsoftexcel: "docs",
  granola: "meetings", zoom: "meetings", fireflies: "meetings",
  hubspot: "crm", salesforce: "crm", attio: "crm",
  github: "code_hosting", gitlab: "code_hosting", bitbucket: "code_hosting",
  posthog: "analytics",
  googledrive: "storage", dropbox: "storage", sharepoint: "storage", onedrive: "storage",
};

/**
 * @typedef {object} Property
 * @property {object} schema JSON Schema for the value.
 * @property {string} doc What the value is, for docs/telemetry.md.
 */

const HASH = { type: "string", pattern: "^[0-9a-f]{16}$" };
// VERSION, or "unknown" when it can't be read.
const PLUGIN_VERSION_PATTERN = "^(unknown|[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?)$";
const enumOf = (/** @type {readonly string[]} */ values) => ({ enum: [...values] });
const list = (/** @type {readonly string[]} */ values) => values.map((value) => `\`${value}\``).join(" \\| ");

/** Properties every event may carry. @type {Record<string, Property>} */
export const COMMON_PROPERTIES = {
  session: {
    schema: HASH,
    doc: "`sha256(session_id)`, first 16 hex characters, where `session_id` is the client's random ID for the session",
  },
  turn: {
    schema: HASH,
    doc: '`sha256(session_id + ":" + prompt_id)`, first 16 hex characters; Claude Code only, because Copilot CLI has no prompt ID',
  },
  arcade_used_before: {
    schema: { type: "boolean" },
    doc: "whether an Arcade tool call had succeeded for this client plugin installation before this event (from the `arcade-used` file)",
  },
  host: { schema: enumOf(TELEMETRY_HOSTS), doc: list(TELEMETRY_HOSTS) },
  telemetry_version: { schema: { const: 2 }, doc: "`2`, the scoped event contract; earlier events have no version" },
  plugin_version: { schema: { type: "string", pattern: PLUGIN_VERSION_PATTERN }, doc: "from `VERSION`" },
  os: { schema: enumOf(OS_NAMES), doc: list(OS_NAMES) },
  $process_person_profile: { schema: { const: false }, doc: "`false`" },
  $geoip_disable: { schema: { const: true }, doc: "`true`" },
  $ip: { schema: { const: "0.0.0.0" }, doc: "`0.0.0.0`, so PostHog stores this instead of your real IP address" },
};

/** Common properties present on every event. */
const ALWAYS_SENT = ["session", "arcade_used_before", "host", "plugin_version", "telemetry_version", "os", "$process_person_profile", "$geoip_disable", "$ip"];

const TOOL_PROPERTIES = {
  server: {
    schema: enumOf(SERVERS),
    doc: "`arcade` (this plugin's gateway) \\| `other_arcade` (another connection exposing Arcade's gateway tools) \\| `other`",
  },
  tool: {
    schema: enumOf(["other", "app_tool", ...GATEWAY_TOOLS]),
    doc: "only for `arcade` and `other_arcade`: an exact gateway tool name, `app_tool` for a recognized service category, or `other`; app tool names are never sent",
  },
  service: {
    schema: enumOf(SERVICE_CATEGORIES),
    doc: "the service category, when the tool, the app tool passed to `Arcade_UseTool`, or the server name matches one",
  },
};

// Tool values are sent only for Arcade connections.
const TOOL_RULES = [
  { if: { properties: { server: { const: "other" } } }, then: { not: { required: ["tool"] } } },
  { if: { properties: { server: enumOf(["arcade", "other_arcade"]) } }, then: { required: ["tool"] } },
];

const TOOL_CALLED_PROPERTIES = {
  ...TOOL_PROPERTIES,
  auth_needed: {
    schema: { type: "boolean" },
    doc: "only for `System_ManageAuthorization`: whether its answer says a service still needs sign-in",
  },
};

const TOOL_ATTEMPTED_PROPERTIES = {
  ...TOOL_PROPERTIES,
  server: {
    schema: enumOf(["arcade", "other_arcade"]),
    doc: "`arcade` (this plugin's gateway) \\| `other_arcade` (the claude.ai Arcade connection)",
  },
};

const TOOL_CALLED_RULES = [
  ...TOOL_RULES,
  {
    if: { required: ["tool"], properties: { tool: { const: "System_ManageAuthorization" } } },
    then: { required: ["auth_needed"] },
    else: { not: { required: ["auth_needed"] } },
  },
];

const TOOL_FAILED_PROPERTIES = {
  ...TOOL_PROPERTIES,
  failure_kind: {
    schema: enumOf(FAILURE_KINDS),
    doc: `picked on your machine from the error message; the message is not sent: ${list(FAILURE_KINDS)}`,
  },
};

const CLI_SERVICE_VALUES = [...new Set(Object.values(CLI_SERVICES))];

const BUILTIN_TOOL_PROPERTIES = {
  tool: { schema: enumOf(BUILTIN_TOOLS), doc: list(BUILTIN_TOOLS) },
  cli: {
    schema: enumOf(BASH_CLIS),
    doc: `only for \`Bash\`: the program the command runs, ${list(BASH_CLIS)}`,
  },
  service: {
    schema: enumOf(CLI_SERVICE_VALUES),
    doc: `the program's service category, only for ${list(Object.keys(CLI_SERVICES))}: ${list(CLI_SERVICE_VALUES)}`,
  },
};

// A Bash call always names its program, and nothing else does. The service
// comes only from CLI_SERVICES.
const BUILTIN_TOOL_RULES = [
  {
    if: { properties: { tool: { const: "Bash" } } },
    then: { required: ["cli"] },
    else: { not: { required: ["cli"] } },
  },
  ...Object.entries(CLI_SERVICES).map(([cli, service]) => ({
    if: { required: ["cli"], properties: { cli: { const: cli } } },
    then: { required: ["service"], properties: { service: { const: service } } },
  })),
  {
    if: { required: ["cli"], properties: { cli: enumOf(Object.keys(CLI_SERVICES)) } },
    else: { not: { required: ["service"] } },
  },
];

const BUILTIN_TOOL_WHEN = `Claude Code only, on \`WebFetch\` and \`WebSearch\`, and on \`Bash\` commands that run ${list(BASH_CLIS)}`;

/**
 * @typedef {object} EventSpec
 * @property {string} hook The Claude Code name of the hook that sends it.
 *   Which clients run that hook, and on which tools, is up to each client's
 *   adapter in hooks/telemetry-adapters/.
 * @property {string} when Extra conditions, for docs/telemetry.md.
 * @property {Record<string, Property>} properties Properties beyond COMMON_PROPERTIES.
 * @property {string[]} required
 * @property {object[]} [rules] Extra JSON Schema rules for this event.
 */

/** @type {Record<string, EventSpec>} */
export const EVENTS = {
  "Plugin prompt submitted": {
    hook: "UserPromptSubmit",
    when: "only for locally classified app work and short confirmations of that work; background task results are excluded. In Copilot CLI a relevant subagent prompt also sends it",
    properties: {
      could_use_arcade: { schema: { type: "boolean" }, doc: "boolean, a local keyword guess (see below)" },
      service_hints: {
        schema: { type: "array", items: enumOf(SERVICE_CATEGORIES), uniqueItems: true },
        doc: "service categories the prompt mentions",
      },
      reminder_sent: { schema: { type: "boolean" }, doc: "boolean, whether the routing reminder was added (always `false` in Copilot CLI)" },
    },
    required: ["could_use_arcade", "service_hints", "reminder_sent"],
  },
  "Plugin tool attempted": {
    hook: "PreToolUse",
    when: "in Claude Code, before an MCP call through this plugin's Arcade gateway or the claude.ai Arcade connection; an attempt does not show whether the tool finished",
    properties: TOOL_ATTEMPTED_PROPERTIES,
    required: ["server", "tool"],
  },
  "Plugin tool called": {
    hook: "PostToolUse",
    when: "on Arcade tools, or alternative MCP tools while the current turn concerns app work",
    properties: TOOL_CALLED_PROPERTIES,
    required: ["server"],
    rules: TOOL_CALLED_RULES,
  },
  "Plugin tool failed": {
    hook: "PostToolUseFailure",
    when: "on Arcade tools, or alternative MCP tools while the current turn concerns app work",
    properties: TOOL_FAILED_PROPERTIES,
    required: ["server", "failure_kind"],
    rules: TOOL_RULES,
  },
  "Plugin built-in tool called": {
    hook: "PostToolUse",
    when: `${BUILTIN_TOOL_WHEN}; only while the current turn concerns app work`,
    properties: BUILTIN_TOOL_PROPERTIES,
    required: ["tool"],
    rules: BUILTIN_TOOL_RULES,
  },
  "Plugin built-in tool failed": {
    hook: "PostToolUseFailure",
    when: `${BUILTIN_TOOL_WHEN}; only while the current turn concerns app work`,
    properties: BUILTIN_TOOL_PROPERTIES,
    required: ["tool"],
    rules: BUILTIN_TOOL_RULES,
  },
  "Plugin subagent stopped": {
    hook: "SubagentStop",
    when: "only for arcade-operator",
    properties: {
      agent: { schema: enumOf(AGENTS), doc: list(AGENTS) },
      status: {
        schema: enumOf(OPERATOR_STATUSES),
        doc: `only for \`arcade-operator\`: the status line of its final report, ${list(OPERATOR_STATUSES)}`,
      },
      subagent_session: {
        schema: HASH,
        doc: "`sha256(agent_id)`, first 16 hex characters. In Copilot CLI the subagent's own events carry this as `session`",
      },
    },
    required: ["agent", "status"],
  },
};

/** Property names an event may carry, common ones included. */
export const allowedProperties = (/** @type {string} */ eventName) => [
  ...Object.keys(COMMON_PROPERTIES),
  ...Object.keys(EVENTS[eventName].properties),
];

/** JSON Schema (2020-12) for one event as sent to PostHog: `{ event, distinct_id, properties }`. */
export const eventSchema = () => ({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  oneOf: Object.entries(EVENTS).map(([name, spec]) => ({
    type: "object",
    additionalProperties: false,
    required: ["event", "distinct_id", "properties"],
    properties: {
      event: { const: name },
      distinct_id: HASH,
      properties: {
        type: "object",
        additionalProperties: false,
        required: [...ALWAYS_SENT, ...spec.required],
        properties: Object.fromEntries(
          allowedProperties(name).map((key) => [key, { ...COMMON_PROPERTIES, ...spec.properties }[key].schema]),
        ),
        ...(spec.rules ? { allOf: spec.rules } : {}),
      },
    },
  })),
});
