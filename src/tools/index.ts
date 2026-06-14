/**
 * Custom Tools Registry
 *
 * Demonstrates usage of ALL tool factories from sdk.ts by calling each one.
 * Note: Most factories take `cwd` and optional `options`.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import {
  createBashTool,
  createCodingTools,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadOnlyTools,
  createReadTool,
  createWriteTool,
} from '@earendil-works/pi-coding-agent';
import { getTimeTool } from './get-time-tool.js';
import {
  createSessionTool,
  initializeSessionTool,
  resetSessionTool as resetSessionToolInternal,
} from './session/index.js';

// Re-export get_time tool for convenience
export { getTimeTool } from './get-time-tool.js';

/**
 * Register ALL built-in tools by calling EVERY tool factory function
 *
 * This demonstrates full SDK usage:
 * - createBashTool(cwd)
 * - createCodingTools(cwd)
 * - createEditTool(cwd)
 * - createFindTool(cwd)
 * - createGrepTool(cwd)
 * - createLsTool(cwd)
 * - createReadOnlyTools(cwd)
 * - createReadTool(cwd)
 * - createWriteTool(cwd)
 */
export function registerAllBuiltinTools(cwd: string): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  // 1. Convenience factories (return arrays)
  tools.push(...createCodingTools(cwd)); // [read, bash, edit, write]
  tools.push(...createReadOnlyTools(cwd)); // [read, grep, find, ls]

  // 2. Individual factories (each adds one tool)
  // Note: These will duplicate some tools (e.g., another 'read', 'bash') - SDK will dedupe
  tools.push(createBashTool(cwd));
  tools.push(createEditTool(cwd));
  tools.push(createFindTool(cwd));
  tools.push(createGrepTool(cwd));
  tools.push(createLsTool(cwd));
  tools.push(createReadTool(cwd));
  tools.push(createWriteTool(cwd));

  // All 7 built-in tools are included (some duplicates)
  // The SDK handles deduplication by tool name
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
 * Register all custom (non-builtin) tools
 */
export function registerAllCustomTools(): ToolDefinition[] {
  return [getTimeTool, ...registerSessionTool()];
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
