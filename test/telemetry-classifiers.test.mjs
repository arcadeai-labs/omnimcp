import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { authNeeded, failureKind } from "../hooks/telemetry-failures.mjs";
import { commandUsesCli } from "../hooks/telemetry-commands.mjs";
import { ROOT } from "./helpers.mjs";

const fixture = (name) => {
  const data = JSON.parse(readFileSync(path.join(ROOT, "test/fixtures/hook-inputs", name), "utf8"));
  return data;
};

// ---------------------------------------------------------------------------
// failureKind
// ---------------------------------------------------------------------------

test("failureKind: interrupted wins when is_interrupt is true", () => {
  const f = fixture("interrupted.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "interrupted");
});

test("failureKind: interrupted requires strict true, not any truthy value", () => {
  assert.equal(failureKind("tool execution timed out after 5s", 1), "timeout");
  assert.equal(failureKind("Connection closed", "true"), "unreachable");
});

test("failureKind: auth_required for hosted Arcade direct tool text", () => {
  const f = fixture("auth-required-arcade.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "auth_required");
});

test("failureKind: auth_required for fake-server authorization_url in error", () => {
  const f = fixture("auth-required-url.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "auth_required");
});

test("failureKind: auth_required for Arcade_UseTool requires authorization text", () => {
  const f = fixture("auth-required-use-tool.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "auth_required");
});

test("failureKind: auth_required for Claude Code 2.1.246 re-authorization error", () => {
  const f = fixture("auth-required-reauth.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "auth_required");
});

test("failureKind: auth_required for Claude Code 2.1.278 sign-in-again error", () => {
  const f = fixture("auth-required-sign-in-again.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "auth_required");
});

test("failureKind: auth_required for Claude Code scope and rejected-credential errors", () => {
  for (const msg of [
    'MCP server "arcade" needs additional permissions (scope: "calendar.read") \u2014 run /mcp to re-authenticate',
    'MCP server "arcade" rejected the credential from its headersHelper (check the helper and run /mcp to reconnect, or to authenticate if the server also uses OAuth)',
    'MCP server "arcade" rejected the Authorization header in its config (update it, then run /mcp to reconnect)',
  ]) {
    assert.equal(failureKind(msg, false), "auth_required", msg);
  }
});

test("failureKind: sign-in and permission wording in a tool's own error stays tool_error", () => {
  assert.equal(failureKind("Please sign in again to continue", false), "tool_error");
  assert.equal(failureKind("The app needs additional permissions to read this file", false), "tool_error");
  assert.equal(failureKind("Upstream API rejected the credential", false), "tool_error");
});

test("failureKind: auth_required for Claude Code needs-to-be-connected error", () => {
  const f = fixture("auth-required-connect.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "auth_required");
});

test("failureKind: auth_required matches case-insensitively", () => {
  assert.equal(failureKind("tool requires Authorization", false), "auth_required");
  assert.equal(failureKind("Authorization Required: dropbox", false), "auth_required");
});

test("failureKind: session_expired for session expired message", () => {
  const f = fixture("session-expired.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "session_expired");
});

test("failureKind: timeout for no-response for 30s message", () => {
  const f = fixture("timeout-no-response.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "timeout");
});

test("failureKind: timeout for gateway-side timed out after", () => {
  const f = fixture("timeout-gateway.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "timeout");
});

test("failureKind: timeout for MCP SDK request timeout", () => {
  const f = fixture("timeout-mcp-request.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "timeout");
});

test("failureKind: unreachable for stdio server Connection closed", () => {
  const f = fixture("unreachable-connection-closed.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "unreachable");
});

test("failureKind: unreachable for MCP SDK Connection closed", () => {
  const f = fixture("unreachable-mcp-connection-closed.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "unreachable");
});

test("failureKind: unreachable for socket connection closed unexpectedly", () => {
  const f = fixture("unreachable-socket.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "unreachable");
});

test("failureKind: unreachable for unable to connect", () => {
  const f = fixture("unreachable-unable-to-connect.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "unreachable");
});

test("failureKind: unreachable for transport dropped mid-call", () => {
  const f = fixture("unreachable-transport-dropped.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "unreachable");
});

test("failureKind: unreachable for Node.js error codes", () => {
  for (const code of ["ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH"]) {
    assert.equal(failureKind(`connect ${code} 127.0.0.1:9`, false), "unreachable", code);
  }
});

test("failureKind: Connection closed matches only alone or after the MCP SDK error code", () => {
  assert.equal(failureKind("Connection closed unexpectedly", false), "tool_error");
  assert.equal(failureKind("Error: Connection closed", false), "tool_error");
  assert.equal(failureKind("The upstream connection closed before the file was saved", false), "tool_error");
  assert.equal(failureKind("MCP error -32603: Connection closed by upstream API", false), "tool_error");
});

test("failureKind: http_error for HTTP 500 response", () => {
  const f = fixture("http-error-500.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "http_error");
});

test("failureKind: http_error for Streamable HTTP error prefix", () => {
  const f = fixture("http-error-streamable.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "http_error");
});

test("failureKind: tool_error for JSON-RPC error message", () => {
  const f = fixture("tool-error-rpc.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "tool_error");
});

test("failureKind: tool_error for rate limit message", () => {
  const f = fixture("tool-error-rate-limit.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "tool_error");
});

test("failureKind: tool_error for non-zero exit code", () => {
  const f = fixture("tool-error-exit-code.json");
  assert.equal(failureKind(f.error, f.is_interrupt), "tool_error");
});

test("failureKind: non-string error falls through to tool_error", () => {
  assert.equal(failureKind(null, false), "tool_error");
  assert.equal(failureKind(undefined, false), "tool_error");
  assert.equal(failureKind(42, false), "tool_error");
  assert.equal(failureKind({ message: "Connection closed" }, false), "tool_error");
});

// ---------------------------------------------------------------------------
// authNeeded
// ---------------------------------------------------------------------------

test("authNeeded: true when providers array contains authorization_required status", () => {
  const response = [
    {
      type: "text",
      text: JSON.stringify({
        message: "Not yet authorized: dropbox.",
        providers: [
          { provider: "dropbox", status: "authorization_required" },
          { provider: "gmail", status: "authorized" },
        ],
      }),
    },
  ];
  assert.equal(authNeeded(response), true);
});

test("authNeeded: false when all providers are authorized", () => {
  const response = [
    {
      type: "text",
      text: JSON.stringify({
        message: "All authorized.",
        providers: [{ provider: "gmail", status: "authorized" }],
      }),
    },
  ];
  assert.equal(authNeeded(response), false);
});

test("authNeeded: false for prose text containing authorization_required outside providers", () => {
  assert.equal(
    authNeeded('{"message":"status is authorization_required","providers":[{"provider":"x","status":"authorized"}]}'),
    false
  );
  assert.equal(authNeeded("This service has authorization_required status"), false);
});

test("authNeeded: false for plain non-JSON text", () => {
  assert.equal(authNeeded([{ type: "text", text: "ok" }]), false);
  assert.equal(authNeeded("some plain text"), false);
});

test("authNeeded: false for null and undefined", () => {
  assert.equal(authNeeded(null), false);
  assert.equal(authNeeded(undefined), false);
});

test("authNeeded: false for non-string non-array inputs", () => {
  assert.equal(authNeeded(42), false);
  assert.equal(authNeeded(true), false);
});

test("authNeeded: false when JSON has no providers field", () => {
  assert.equal(authNeeded('{"status":"authorization_required"}'), false);
  assert.equal(authNeeded(JSON.stringify({ message: "ok" })), false);
});

// ---------------------------------------------------------------------------
// commandUsesCli
// ---------------------------------------------------------------------------

test("commandUsesCli: matches bare CLI name", () => {
  assert.equal(commandUsesCli("gh --version", "gh"), true);
});

test("commandUsesCli: matches CLI after && in compound command", () => {
  assert.equal(commandUsesCli("cd . && gh --version", "gh"), true);
});

test("commandUsesCli: matches CLI after leading NAME=value assignment", () => {
  assert.equal(commandUsesCli("GH_PAGER=cat gh --version", "gh"), true);
});

test("commandUsesCli: matches CLI after multiple assignments", () => {
  assert.equal(commandUsesCli("GH_PAGER=cat GH_NO_UPDATE_NOTIFIER=1 gh pr list", "gh"), true);
});

test("commandUsesCli: matches CLI after || separator", () => {
  assert.equal(commandUsesCli("false || gh --version", "gh"), true);
});

test("commandUsesCli: matches CLI after ; separator", () => {
  assert.equal(commandUsesCli("echo hi; gh status", "gh"), true);
});

test("commandUsesCli: matches CLI after | separator", () => {
  // after the |, "gh" is the first word of the next segment
  assert.equal(commandUsesCli("echo text | gh gist create -", "gh"), true);
  assert.equal(commandUsesCli("cat file | gh gist create -", "gh"), true);
  // "gh" as an argument of echo, before any separator, does not match
  assert.equal(commandUsesCli("echo gh", "gh"), false);
});

test("commandUsesCli: matches CLI after ( separator", () => {
  assert.equal(commandUsesCli("(gh --version)", "gh"), true);
});

test("commandUsesCli: matches CLI after newline separator", () => {
  assert.equal(commandUsesCli("echo hi\ngh --version", "gh"), true);
});

test("commandUsesCli: does not match CLI appearing as argument", () => {
  assert.equal(commandUsesCli("echo gh", "gh"), false);
});

test("commandUsesCli: does not match absolute path to CLI", () => {
  assert.equal(commandUsesCli("/opt/homebrew/bin/gh --version", "gh"), false);
});

test("commandUsesCli: does not match a different command that starts with CLI name", () => {
  assert.equal(commandUsesCli("ghost list", "gh"), false);
});

test("commandUsesCli: does not match CLI name inside a string argument", () => {
  assert.equal(commandUsesCli('python -c "gh"', "gh"), false);
});

test("commandUsesCli: returns false for non-string command", () => {
  assert.equal(commandUsesCli(null, "gh"), false);
  assert.equal(commandUsesCli(undefined, "gh"), false);
  assert.equal(commandUsesCli(42, "gh"), false);
  assert.equal(commandUsesCli(["gh", "--version"], "gh"), false);
});

test("commandUsesCli: works for all listed CLIs", () => {
  for (const cli of ["gh", "glab", "curl", "wget", "http", "osascript"]) {
    assert.equal(commandUsesCli(`${cli} --version`, cli), true, cli);
    assert.equal(commandUsesCli(`echo ${cli}`, cli), false, `echo ${cli}`);
  }
});

test("commandUsesCli: curl after && compound command", () => {
  assert.equal(commandUsesCli("cd . && curl --version", "curl"), true);
});
