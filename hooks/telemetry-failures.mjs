// @ts-check
/** Classifiers for failure_kind and auth_needed from hook inputs. */

/** @typedef {"auth_required"|"session_expired"|"unreachable"|"timeout"|"http_error"|"interrupted"|"tool_error"} FailureKind */

// Claude Code 2.1.246 says "requires re-authorization". 2.1.278 says "needs
// you to sign in again", "needs additional permissions", or "rejected the
// credential from its headersHelper" / "rejected the Authorization header".
const AUTH_REQUIRED_RE =
  /requires authorization|authorization required|"authorization_url"|requires re-authorization|needs to be connected in claude\.ai|needs you to sign in again|needs additional permissions \(scope:|rejected the credential from its headersHelper|rejected the Authorization header in its config/i;
const SESSION_EXPIRED_RE = /session expired/;
const TIMEOUT_RE = /sent no response or progress for|timed out after|MCP error -32001: Request timed out/;
const UNREACHABLE_RE =
  /Unable to connect|socket connection was closed unexpectedly|^Connection closed$|MCP error -32000: Connection closed|ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|transport dropped mid-call|transport closed before the tool responded/;
const HTTP_ERROR_RE = /Error POSTing to endpoint/;

/**
 * Returns the failure_kind for a PostToolUseFailure hook input.
 * First matching rule wins.
 *
 * @param {unknown} error
 * @param {unknown} isInterrupt
 * @returns {FailureKind}
 */
export const failureKind = (error, isInterrupt) => {
  if (isInterrupt === true) return "interrupted";
  const msg = typeof error === "string" ? error : "";
  if (AUTH_REQUIRED_RE.test(msg)) return "auth_required";
  if (SESSION_EXPIRED_RE.test(msg)) return "session_expired";
  if (TIMEOUT_RE.test(msg)) return "timeout";
  if (UNREACHABLE_RE.test(msg)) return "unreachable";
  if (HTTP_ERROR_RE.test(msg)) return "http_error";
  return "tool_error";
};

/**
 * Returns true when a System_ManageAuthorization tool_response indicates that
 * at least one provider still needs sign-in. The tool_response is the content
 * array [{type:"text",text}] as Claude Code delivers it, or a plain string.
 * Parses the JSON text and checks providers[].status === "authorization_required".
 *
 * @param {unknown} toolResponse
 * @returns {boolean}
 */
export const authNeeded = (toolResponse) => {
  if (toolResponse === null || toolResponse === undefined) return false;
  try {
    /** @type {string|undefined} */
    let text;
    if (typeof toolResponse === "string") {
      text = toolResponse;
    } else if (Array.isArray(toolResponse)) {
      const first = toolResponse[0];
      if (first && typeof first === "object" && "text" in first && typeof first.text === "string") {
        text = first.text;
      }
    }
    if (text === undefined) return false;
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.providers)) return false;
    return parsed.providers.some(
      (/** @type {unknown} */ p) =>
        p !== null &&
        typeof p === "object" &&
        /** @type {Record<string,unknown>} */ (p).status === "authorization_required",
    );
  } catch {
    return false;
  }
};
