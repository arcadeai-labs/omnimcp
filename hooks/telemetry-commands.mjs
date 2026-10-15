// @ts-check
/**
 * Check whether a shell command segment invokes the named CLI.
 * Used to guard against clients that ignore the `if` field on hook entries.
 */

// Split on shell segment separators: &&, ||, ;, |, newline, (
const SEGMENT_SPLIT = /&&|\|\||[;|\n(]/;

// Shell variable assignment: NAME=value at the start of a word
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Returns true when `command` contains a segment whose first non-assignment
 * word is exactly `cli`. Absolute paths and substrings do not match.
 *
 * @param {unknown} command
 * @param {string} cli
 * @returns {boolean}
 */
export const commandUsesCli = (command, cli) => {
  if (typeof command !== "string") return false;
  const segments = command.split(SEGMENT_SPLIT);
  for (const segment of segments) {
    const words = segment.trim().split(/\s+/);
    let i = 0;
    while (i < words.length && ASSIGNMENT.test(words[i])) i++;
    if (i < words.length && words[i] === cli) return true;
  }
  return false;
};
