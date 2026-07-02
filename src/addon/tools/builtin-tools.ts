import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import {
  createBashToolDefinition,
  createReadToolDefinition,
  createEditToolDefinition,
  createWriteToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
} from '@earendil-works/pi-coding-agent';

/**
 * Register ALL built-in tools by calling individual factory functions.
 * Cast each to ToolDefinition to satisfy TypeScript due to generic variance.
 */
export function registerAllBuiltinTools(cwd: string): ToolDefinition[] {
  return [
    createBashToolDefinition(cwd) as ToolDefinition,
    createReadToolDefinition(cwd) as ToolDefinition,
    createEditToolDefinition(cwd) as ToolDefinition,
    createWriteToolDefinition(cwd) as ToolDefinition,
    createFindToolDefinition(cwd) as ToolDefinition,
    createGrepToolDefinition(cwd) as ToolDefinition,
    createLsToolDefinition(cwd) as ToolDefinition,
  ];
}
