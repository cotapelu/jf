/**
 * Command line argument parsing utilities for slash commands.
 * Reduces duplication across command handlers.
 */

export interface ParsedArgs {
  action: string;
  args: string[];
}

/**
 * Split command input into action and arguments.
 * Trims whitespace and splits on any whitespace.
 * @param input Raw command string (everything after the command name)
 * @returns Parsed action and argument array
 */
export function parseArgs(input: string): ParsedArgs {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { action: "", args: [] };
  }
  const parts = trimmed.split(/\s+/);
  return {
    action: parts[0],
    args: parts.slice(1),
  };
}

/**
 * Validate that enough arguments are present.
 * Throws an Error with a usage message if validation fails.
 * @param parsed Parsed arguments
 * @param minArgs Minimum number of required arguments (excluding action)
 * @param usage Optional usage string to show on error
 */
export function requireArgs(parsed: ParsedArgs, minArgs: number, usage?: string): void {
  if (parsed.args.length < minArgs) {
    const msg = usage || `Usage: ${parsed.action} <args...> (need at least ${minArgs} argument(s))`;
    throw new Error(msg);
  }
}

/**
 * Get a specific argument by index, with optional default.
 */
export function getArg(parsed: ParsedArgs, index: number, defaultValue?: string): string | undefined {
  if (index < parsed.args.length) return parsed.args[index];
  return defaultValue;
}
