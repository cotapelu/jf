#!/usr/bin/env node

/**
 * Master Tool - Main Entry Point
 *
 * Exports:
 * - registerMasterTool: Register the master tool with extension API
 * - createMasterTool: Create tool definition with custom options
 * - Command types & utilities for command developers
 */

export { registerMasterTool, createMasterTool, getRegistry } from "./master-tool.js";
export type {
  CommandModule,
  CommandMetadata,
  CommandResult,
  CommandLoader,
  MasterToolOptions
} from "./types/command-module.js";

// Re-export utilities for command developers
export { CommandCache } from "./utils/command-cache.js";
export { CommandValidator, getValidator } from "./utils/command-validator.js";
export { createCommandRegistry } from "./command-registry.js";
