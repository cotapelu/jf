#!/usr/bin/env node

/**
 * Command Module Interface
 *
 * Mỗi command là file riêng export:
 * - metadata: CommandMetadata
 * - schema: TypeBox schema
 * - execute: async function
 *
 * Example command file:
 * ```ts
 * import { Type } from "typebox";
 *
 * export const metadata = {
 *   name: "git.status",
 *   category: "git",
 *   description: "Show git status",
 *   examples: ["master_tool({ command: 'git.status', args: {} })"]
 * };
 *
 * export const schema = Type.Object({ ... });
 *
 * export async function execute(args, cwd, signal, ctx) {
 *   const result = await ctx.exec('git', ['status'], { cwd, signal });
 *   return { stdout: result.stdout, stderr: result.stderr, code: result.code };
 * }
 * ```
 */

import type { TSchema } from "typebox";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface CommandMetadata {
  /** Unique command ID (e.g., "git.status") */
  name: string;
  /** Category for grouping (e.g., "git", "dev", "system") */
  category: string;
  /** Human-readable description */
  description: string;
  /** Long description (optional) */
  longDescription?: string;
  /** Array of usage examples */
  examples?: string[];
  /** Dependencies on other commands (by name) */
  dependsOn?: string[];
  /** Tags for filtering */
  tags?: string[];
  /** Whether this command is experimental */
  experimental?: boolean;
  /** Minimum PiClaw version required */
  minVersion?: string;
  /** Permission hints (future: fs:read, exec:git, etc.) */
  permissions?: string[];
}

export interface CommandResult {
  /** Exit code (0 = success) */
  code: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Optional structured data */
  data?: any;
  /** Execution duration in ms */
  duration?: number;
}

export interface CommandModule<TInput = any, TOutput = any, TState = any> {
  /** Command metadata (REQUIRED) */
  metadata: CommandMetadata;

  /** Input schema for validation (REQUIRED) */
  schema: TSchema;

  /** Execute function (REQUIRED) */
  execute(
    args: TInput,
    cwd: string,
    signal?: AbortSignal,
    ctx?: ExtensionContext & { commandState?: TState },
  ): Promise<CommandResult>;

  /** Optional: Pre-execute hook */
  beforeExecute?(args: TInput, ctx: ExtensionContext & { commandState?: TState }): Promise<void>;

  /** Optional: Post-execute hook */
  afterExecute?(result: CommandResult, ctx: ExtensionContext & { commandState?: TState }): Promise<void>;

  /** Optional: Custom renderer for this command */
  renderResult?(result: CommandResult, options: any, theme: any): any;

  /** Optional: State class for persistent state */
  StateClass?: new () => TState;

  /** Optional: Persistence path generator */
  getPersistencePath?: (ctx: ExtensionContext, commandName: string) => string;
}

export type CommandLoader = () => Promise<CommandModule>;

// Command registry entry
export interface CommandRegistryEntry {
  loader: CommandLoader;
  metadata: CommandMetadata;
  schema: TSchema;
  module?: CommandModule; // Cached loaded module
  StateClass?: new () => any; // Optional state class
  getPersistencePath?: (ctx: ExtensionContext, commandName: string) => string;
  lastLoaded: number;
  loadCount: number;
  errorCount: number;
  lastError?: string;
}

// Master tool options
export interface MasterToolOptions {
  /** Commands directory (default: ./commands relative to master-tool.ts) */
  commandsDir?: string;
  /** Enable command caching (default: true) */
  enableCache?: boolean;
  /** Cache TTL in ms (default: 5 minutes) */
  cacheTTL?: number;
  /** Enable audit logging (default: false) */
  enableAudit?: boolean;
  /** Max command output size (default: 1MB) */
  maxOutputSize?: number;
  /** Rate limit: max executions per minute (0 = unlimited) */
  rateLimitPerMinute?: number;
  /** Categories to exclude from loading (e.g., ['experimental']) */
  excludeCategories?: string[];
  /** Commands to exclude by name */
  excludeCommands?: string[];
}

export const DEFAULT_MASTER_TOOL_OPTIONS: MasterToolOptions = {
  enableCache: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  enableAudit: false,
  maxOutputSize: 1024 * 1024, // 1MB
  rateLimitPerMinute: 0, // unlimited
  excludeCategories: [],
  excludeCommands: []
};
