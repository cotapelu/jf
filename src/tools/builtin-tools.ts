// src/tools/builtin-tools.ts
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import {
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createFindTool,
  createGrepTool,
  createLsTool,
} from '@earendil-works/pi-coding-agent';

/**
 * Register ALL built-in tools (including file discovery tools)
 * These will be treated as custom tools and passed via customTools array.
 */
export function registerAllBuiltinTools(cwd: string): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  // Core file operations
  tools.push(createReadTool(cwd));
  tools.push(createBashTool(cwd));
  tools.push(createEditTool(cwd));
  tools.push(createWriteTool(cwd));

  // File discovery tools (each is a single ToolDefinition)
  tools.push(createFindTool(cwd));
  tools.push(createGrepTool(cwd));
  tools.push(createLsTool(cwd));

  return tools;
}
