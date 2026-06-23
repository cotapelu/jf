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
import { compactContextTool } from './compaction/index.js';
import { createSessionTool, initializeSessionTool, resetSessionTool as resetSessionToolInternal, } from './session/index.js';
import { createMultiAgentTool } from './multi-agent/index.js';
import { skillTool } from './skills/index.js';

// Re-export get_time tool for convenience
export { getTimeTool } from './time/index.js';

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
  tools.push(createBashTool(cwd));
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
	return [getTimeTool, codebaseIndexTool, compactContextTool, skillTool, ...registerMultiAgentTool(), ...registerSessionTool()];
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
