/**
 * Arcade routing rules. This file is the only place the rules are written.
 * The hooks import these strings, and `npm run generate` copies
 * them into the Cursor rule, arcade-operator, and the try-arcade skill.
 */

const CURSOR_NAME =
  "It may appear as plugin-arcade-arcade. That is the same gateway";

const GATEWAY =
  'Arcade is connected as the "arcade" MCP server at ' +
  `api.arcade.dev. ${CURSOR_NAME}. Prefer arcade.`;

const DELEGATE_GATEWAY =
  'Arcade is connected as the "arcade" MCP server at api.arcade.dev. ' +
  "It may be called plugin-arcade-arcade. Prefer arcade, but if needed use another " +
  "Arcade gateway to find the tool you need. If none exist, say what is left " +
  "in your result so that the parent agent can finish it.";

const GATEWAY_CHECK =
  "Discover tools on each gateway; never reuse another gateway's query IDs. " +
  "Do not broaden authorization or copy secrets, credentials, or user sessions. " +
  "On another gateway, confirm the intended app account with the app's who-am-I " +
  "tool. Write only through a confirmed account, and name the source account " +
  "for reads.";

const PARENT_FALLBACK =
  "If the arcade server cannot finish, the parent may use another already-authorized " +
  "Arcade gateway or other available tools within the authorized task. " +
  GATEWAY_CHECK + " If you can't, ask the user.";

const DELEGATE_FALLBACK =
  "If the arcade server cannot finish, use another already-authorized Arcade gateway " +
  "within the delegated task. " + GATEWAY_CHECK + " If you can't, return needs_confirmation.";

const AUTH_DEFINITION =
  "A gateway showing needsAuth or a plugin namespace with zero tools needs " +
  "authentication in this host's MCP settings. A missing, unavailable, or failing gateway " +
  "needs setup or connection repair.";

// The parent conversation talks to the user. A subagent or arcade-operator
// reports back to the parent instead.
const AUTH_ACTION_PARENT =
  "For authentication, stop and ask the user to authenticate; do not poll. " +
  "For permission denial, stop and ask the user to resolve it. " +
  "Do not bypass either by switching gateways or tools. For other failures, " +
  "report the error, advise checking plugin and MCP settings for setup or " +
  "connection failures, then apply fallback.";

const AUTH_ACTION_DELEGATE =
  "For authentication, return needs_auth. For permission denial, return failed " +
  "with the actual error. Do not bypass either by switching gateways or tools. " +
  "For other failures, report the error, recommend checking plugin and MCP " +
  "settings for setup or connection failures, then apply fallback or return failed.";

// arcade-operator and other subagents report to a parent that can use other
// tools, so they finish only through Arcade and hand back what Arcade couldn't do.
const NO_SUBSTITUTES =
  "Use Arcade gateways for delegated work. Do not substitute non-Arcade MCP " +
  "servers, CLIs, built-in search, or direct APIs. Return unfinished work to the parent.";

const DELEGATION =
  "Use try-arcade first for external app tasks (email, calendar, chat, docs, " +
  "issues, CRM); use scale-arcade for team or org rollout. Delegate bounded " +
  "app tasks to arcade-operator when available.";

const PRIVACY = "Keep tool discovery and tool names out of the conversation.";

const line = (label, text) => `${label}: ${text}`;

const PARENT_RULES = [
  line("Gateway", GATEWAY),
  line("Authentication", AUTH_DEFINITION),
  line("If blocked", AUTH_ACTION_PARENT),
  line("Fallback", PARENT_FALLBACK),
];
const DELEGATE_RULES = [
  line("Gateway", DELEGATE_GATEWAY),
  line("Authentication", AUTH_DEFINITION),
  line("If blocked", AUTH_ACTION_DELEGATE),
  line("Fallback", DELEGATE_FALLBACK),
  line("Stay on Arcade", NO_SUBSTITUTES),
];

// One labeled line per rule, so a host that injects the whole set can scan it.
const join = (...parts) => parts.join("\n");

// Generated into the try-arcade skill and arcade-operator.
export const SKILL_RULES = join(...PARENT_RULES);
export const OPERATOR_RULES = join(...DELEGATE_RULES);

// Printed by the session-start hook.
export const SESSION_CONTEXT = join(...PARENT_RULES, line("Routing", DELEGATION), line("Privacy", PRIVACY));

// Sent on most user turns, so it is one short paragraph. The full rules come
// from SESSION_CONTEXT, try-arcade, and arcade-operator.
export const PROMPT_REMINDER =
  'For external app tasks, use try-arcade (or arcade-operator when available) ' +
  'first through the "arcade" MCP server, and scale-arcade for team rollout. ' +
  "The parent may finish work the arcade server cannot complete under the try-arcade fallback rules.";

// Cursor's always-apply rule. The Cursor IDE and Cloud Agents don't run plugin
// hooks, so the rule carries the full session rules. The Cursor CLI runs the
// session hook but doesn't load this rule, so it never gets both.
export const CURSOR_RULE = SESSION_CONTEXT;

// Subagents can't start arcade-operator themselves, so they get try-arcade
// without the delegation sentence.
export const SUBAGENT_CONTEXT = join(
  line("Session", "This subagent shares the parent session."),
  ...DELEGATE_RULES,
  line("Routing", "For external service tasks, use try-arcade."),
  line("Privacy", PRIVACY),
);

const OPERATOR_AGENT = "arcade-operator";

/** True for arcade-operator, bare or plugin-scoped (e.g. "arcade:arcade-operator"). */
export const isOperatorAgentType = (agentType) =>
  typeof agentType === "string" &&
  (agentType === OPERATOR_AGENT || agentType.endsWith(`:${OPERATOR_AGENT}`));
