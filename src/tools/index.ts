/**
 * Custom Tools Registry
 *
 * Demonstrates usage of ALL tool factories from sdk.ts by calling each one.
 * Note: Most factories take `cwd` and optional `options`.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BashToolOptions, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { createBashTool, createCodingTools, createEditTool, createFindTool, createGrepTool, createLsTool, createReadOnlyTools, createReadTool, createWriteTool, } from '@earendil-works/pi-coding-agent';
import { getTimeTool } from './time/index.js';
import { codebaseIndexTool } from './indexer/index.js';
import { createSessionTool, initializeSessionTool, resetSessionTool as resetSessionToolInternal, } from './session/index.js';
import { createMultiAgentTool } from './multi-agent/index.js';
import { skillTool } from './skills/index.js';

// Re-export get_time tool for convenience
export { getTimeTool } from './time/index.js';

/**
 * Create enhanced bash tool with clear guidelines and safety rules
 */
function createEnhancedBashTool(cwd: string, options?: BashToolOptions): ToolDefinition {
  const baseTool = createBashTool(cwd, options);
  return {
    ...baseTool,
    promptSnippet: 'Execute shell commands (ls, grep, mkdir, rm, etc.) with timeout. Always check exit code. Prefer specialized tools (read, edit, write, find, grep, ls) when available.',
    promptGuidelines: [
      'Use absolute paths or paths relative to current working directory (cwd)',
      'PREFER built-in specialized tools over bash:',
      '  - read: for reading file contents',
      '  - edit: for modifying files',
      '  - write: for creating files',
      '  - find/grep/ls: for file discovery and searching',
      'Only use bash for operations NOT covered by specialized tools (e.g., package managers, build systems, custom scripts)',
      'ALWAYS provide timeout for long-running commands: network (curl, npm, pip), compilation (make, gcc), tests, large file operations',
      '  Example: { command: "npm test", timeout: 60 }',
      'Non-zero exit code = failure. ALWAYS examine stderr output in result for error details',
      'Avoid interactive commands requiring stdin. Use flags: -y, --no-prompt, --quiet, or input redirection (<, <<)',
      'Clean up temporary files immediately after use (rm -f, tmpdir)',
      'Split complex multi-step operations into separate bash calls for better observability and error isolation',
      'Use proper quoting and escaping: "$VAR" (expand), \'$VAR\' (literal), \\ for escaping',
      'Check existence before operations: test -f file.txt, test -d dir, [ -e path ]',
      'For critical operations, prepend set -e to exit on first error',
      'Understand output truncation: last 2000 lines or 50KB (whichever first); full output saved to temp file if truncated',
      'NEVER use rm -rf /, dd, fork bombs, or destructive commands without explicit confirmation',
      'Respect project structure: operate only within cwd, do not modify system files (/etc, /usr, C:\\Windows)',
    ],
  };
}

/**

/**
 * Register ALL built-in tools with enhanced metadata
 *
 * Each tool added individually to control metadata and avoid duplicates.
 */
export function registerAllBuiltinTools(cwd: string): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  // Core file operations
  tools.push(createReadTool(cwd));
  tools.push(createEnhancedBashTool(cwd));
  tools.push(createEditTool(cwd));
  tools.push(createWriteTool(cwd));

  // File discovery tools
  tools.push(createFindTool(cwd));
  tools.push(createGrepTool(cwd));
  tools.push(createLsTool(cwd));

  return tools;
}

/**
 * Register session tool (manager initializes lazily on first use)
 */
export function registerSessionTool(): ToolDefinition[] {
	// Defer initialization until tool execution (lazy)
	return [createSessionTool()];
}

/**
 * Register multi-agent tool
 */
export function registerMultiAgentTool(): ToolDefinition[] {
	return [createMultiAgentTool()];
}

/**
 * Register all custom (non-builtin) tools
 */
export function registerAllCustomTools(): ToolDefinition[] {
	return [getTimeTool, skillTool, codebaseIndexTool, ...registerMultiAgentTool(), ...registerSessionTool()];
}

/**
 * Combined: ALL tools (built-in via all factories + custom)
 */
export function registerAllTools(cwd: string): ToolDefinition[] {
	return [...registerAllBuiltinTools(cwd), ...registerAllCustomTools()];
}

/**
 * Reset session tool (useful for testing)
 */
export function resetSessionTool(): void {
	resetSessionToolInternal();
}
