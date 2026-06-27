/**
 * Custom Tools Registry
 *
 * Re-exports from builtin-tools and custom modules.
 * Provides single entry point for all tool definitions.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { getTimeTool } from './time/index.js';
import { codebaseIndexTool } from './indexer/index.js';
import { compactContextTool } from './compaction/index.js';
import { createSessionTool, initializeSessionTool, resetSessionTool as resetSessionToolInternal, } from './session/index.js';
import { createMultiAgentTool } from './multi-agent/index.js';
import { skillTool } from './skills/index.js';
import { registerAllBuiltinTools } from './builtin-tools.js';

// Re-export tools for convenience
export { getTimeTool } from './time/index.js';
export { codebaseIndexTool } from './indexer/index.js';
export { initializeSessionTool, createSessionTool } from './session/index.js';
export { createMultiAgentTool } from './multi-agent/index.js';
export { compactContextTool } from './compaction/index.js';
export { skillTool } from './skills/index.js';
export { registerAllBuiltinTools } from './builtin-tools.js';

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
export function registerAllBuiltinAndCustomTools(cwd: string): ToolDefinition[] {
	return [...registerAllBuiltinTools(cwd), ...registerAllCustomTools()];
}

/**
 * Reset session tool (useful for testing)
 */
export function resetSessionTool(): void {
	resetSessionToolInternal();
}
