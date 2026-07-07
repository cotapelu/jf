#!/usr/bin/env node

/**
 * Command Executor - với STATE SUPPORT
 *
 * Router: validate, execute (with state), audit, error handling.
 * Stateful commands: auto-restore, mutex, auto-save.
 */

import type {
  CommandModule,
  CommandMetadata,
  CommandResult,
  CommandRegistryEntry,
  MasterToolOptions
} from "./types/command-module.js";
import { DEFAULT_MASTER_TOOL_OPTIONS } from "./types/command-module.js";
import { CommandCache } from "./utils/command-cache.js";
import { CommandValidator, getValidator } from "./utils/command-validator.js";
// import { Text } from "@earendil-works/pi-tui"; // unused
import { StateManager } from "./state-manager.js";

export interface ExecutionContext {
  toolCallId: string;
  signal: AbortSignal | undefined;
  onUpdate: ((update: any) => void) | undefined;
  ctx: any; // ExtensionContext
  maxOutputSize: number;
}

export interface AuditLog {
  timestamp: number;
  toolCallId: string;
  command: string;
  userId?: string;
  success: boolean;
  durationMs?: number;
  error?: string;
  argsSize: number;
  outputSize: number;
}

/**
 * Command Executor
 */
export class CommandExecutor {
  private registry: Map<string, CommandRegistryEntry> = new Map();
  private cache: CommandCache;
  private validator: CommandValidator;
  private options: MasterToolOptions;
  private auditLogs: AuditLog[] = [];
  private enableAudit: boolean;
  private stateManager: StateManager;
  private commandStats: Map<string, { count: number; totalDuration: number }> = new Map();

  constructor(options: MasterToolOptions = {}) {
    this.options = { ...DEFAULT_MASTER_TOOL_OPTIONS, ...options };
    this.cache = new CommandCache({
      ttl: this.options.cacheTTL,
      maxSize: 200
    });
    this.validator = getValidator({ rateLimitPerMinute: this.options.rateLimitPerMinute });
    this.enableAudit = this.options.enableAudit ?? false;
    this.stateManager = new StateManager();
    this.commandStats = new Map();
  }

  private updateCommandStats(commandName: string, duration: number): void {
    const stats = this.commandStats.get(commandName) ?? { count: 0, totalDuration: 0 };
    stats.count++;
    stats.totalDuration += duration;
    this.commandStats.set(commandName, stats);
  }

  /**
   * Register a command module (from dynamic import)
   */
  register(entry: CommandRegistryEntry): void {
    const name = entry.metadata.name;

    // Check exclude
    if (this.options.excludeCommands?.includes(name)) {
      return;
    }
    if (this.options.excludeCategories?.includes(entry.metadata.category)) {
      return;
    }

    this.registry.set(name, entry);
  }

  /**
   * Unregister a command
   */
  unregister(name: string): boolean {
    return this.registry.delete(name);
  }

  /**
   * Get all registered command names
   */
  listCommands(): string[] {
    return Array.from(this.registry.keys()).sort();
  }

  /**
   * Get commands by category
   */
  listCommandsByCategory(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const [name, entry] of this.registry) {
      const cat = entry.metadata.category;
      const list = map.get(cat) ?? [];
      list.push(name);
      map.set(cat, list.sort());
    }
    return map;
  }

  /**
   * Get metadata for a command
   */
  getMetadata(name: string): CommandMetadata | undefined {
    return this.registry.get(name)?.metadata;
  }

  /**
   * Get schema for a command
   */
  getSchema(name: string): any {
    return this.registry.get(name)?.schema;
  }

  /**
   * Execute a command
   */
  async execute(
    commandName: string,
    args: any,
    execCtx: ExecutionContext
  ): Promise<CommandResult> {
    const entry = this.registry.get(commandName);
    if (!entry) {
      return this.makeErrorResult(`Command not found: ${commandName}`, "command_not_found");
    }
    const startTime = Date.now();
    try {
      // Load module (with error handling)
      let module: CommandModule;
      try {
        module = await this.loadModule(commandName, entry);
      } catch (e) {
        return this.handleLoadError(e, entry, commandName);
      }

      // Validate arguments and security
      const validationErr = this.validateAll(commandName, args, module);
      if (validationErr) return validationErr;

      // Prepare state and mutex
      const { state, releaseMutex } = await this.ensureStatePrepared(module, execCtx);
      try {
        // Execute command (hooks, before/after, state save, output limits, audit)
        const result = await this.runCommandPhases(module, args, execCtx, state, startTime);
        // Update metadata on success
        entry.loadCount++;
        entry.lastLoaded = Date.now();
        return result;
      } finally {
        if (releaseMutex) releaseMutex();
      }
    } catch (err) {
      // Unexpected errors
      return this.handleExecutionError(err, entry, commandName, execCtx, startTime);
    } finally {
      this.updateCommandStats(commandName, Date.now() - startTime);
    }
  }

  /**
   * Load module from cache or dynamic import
   */
  private async loadModule(commandName: string, entry: CommandRegistryEntry): Promise<CommandModule> {
    // Check cache first
    const cached = this.cache.get(commandName);
    if (cached) {
      return cached;
    }

    // Dynamic import
    try {
      const mod = await entry.loader();

      // Cache it
      this.cache.set(commandName, mod, mod.metadata);

      // Update registry entry with loaded module (for reuse without cache)
      entry.module = mod;
      entry.StateClass = mod.StateClass;
      entry.getPersistencePath = mod.getPersistencePath;
      entry.lastLoaded = Date.now();
      // Sync metadata from loaded module (in case placeholder was set)
      entry.metadata = mod.metadata;

      return mod;
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load command '${commandName}': ${msg}`);
    }
  }

  /**
   * Create standardized error result
   */
  private makeErrorResult(
    message: string,
    errorCode: string,
    extra?: any
  ): CommandResult {
    return {
      code: 1,
      stdout: "",
      stderr: `❌ ${message}`,
      data: { error: errorCode, ...extra }
    };
  }

  /**
   * Audit logging
   */
  private logAudit(log: AuditLog): void {
    this.auditLogs.push(log);
    // Keep only last 1000 logs
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }
  }

  /**
   * Get audit logs (for debugging/monitoring)
   */
  getAuditLogs(since?: number): AuditLog[] {
    if (since) {
      return this.auditLogs.filter(log => log.timestamp >= since);
    }
    return [...this.auditLogs];
  }

  /**
   * Clear audit logs
   */
  clearAuditLogs(): void {
    this.auditLogs = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    registeredCommands: number;
    cacheStats: any;
    recentErrors: Array<{ command: string; error: string; count: number }>;
    totalExecutions: number;
    successRate: number;
    commandStats: Array<{ command: string; count: number; avgDuration: number }>;
  } {
    const totalExecutions = this.auditLogs.length;
    const successRate = this.computeSuccessRate(totalExecutions);
    const errorMap = this.groupErrorsByCommand();
    const commandStatsArray = this.formatCommandStats();

    return {
      registeredCommands: this.registry.size,
      cacheStats: this.cache.getStats(),
      recentErrors: this.formatRecentErrors(errorMap),
      totalExecutions,
      successRate,
      commandStats: commandStatsArray
    };
  }

  private computeSuccessRate(totalExecutions: number): number {
    if (totalExecutions === 0) return 0;
    const successful = this.auditLogs.filter(l => l.success).length;
    return Math.round(((successful / totalExecutions) * 100) * 10) / 10;
  }

  private groupErrorsByCommand(): Map<string, { count: number; lastError: string }> {
    const errorMap = new Map<string, { count: number; lastError: string }>();
    for (const log of this.auditLogs) {
      if (!log.success && log.error) {
        const existing = errorMap.get(log.command) ?? { count: 0, lastError: "" };
        errorMap.set(log.command, {
          count: existing.count + 1,
          lastError: log.error
        });
      }
    }
    return errorMap;
  }

  private formatCommandStats(): Array<{ command: string; count: number; avgDuration: number }> {
    return Array.from(this.commandStats.entries()).map(([command, stats]) => ({
      command,
      count: stats.count,
      avgDuration: stats.totalDuration / stats.count
    }));
  }

  private formatRecentErrors(errorMap: Map<string, { count: number; lastError: string }>): Array<{ command: string; error: string; count: number }> {
    return Array.from(errorMap.entries())
      .map(([command, data]) => ({ command, error: data.lastError, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Clear cache (for reloading)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate command cache (force reload next time)
   */
  invalidateCommand(commandName: string): boolean {
    return this.cache.invalidate(commandName);
  }

  /**
   * Invalidate all commands in a category
   */
  invalidateCategory(category: string): void {
    this.cache.invalidateCategory(category);
  }

  // --- Refactored helpers for execute ---
  private validateAll(commandName: string, args: any, module: CommandModule): CommandResult | null {
    const rate = this.validator.checkRateLimit(commandName);
    if (!rate.allowed) return this.makeErrorResult(`Rate limit exceeded. Reset in ${rate.resetIn}s`, "rate_limit_exceeded");
    const schema = this.validator.validateWithSchema(args, module.schema, commandName);
    if (!schema.valid) {
      const errors = schema.errors?.map(e => `${e.path?.join('.') || ''}: ${e.message}`).join('; ') || 'Invalid arguments';
      return this.makeErrorResult(`Validation failed: ${errors}`, "validation_failed", { validationErrors: schema.errors });
    }
    const sec = this.validator.validateSecurity(args, module.metadata);
    if (!sec.valid) return this.makeErrorResult(`Security: ${sec.errors.join(', ')}`, "security_error");
    return null;
  }

  private async ensureStatePrepared(module: CommandModule, execCtx: ExecutionContext): Promise<{state: any, releaseMutex: (()=>void) | null}> {
    let state: any = null;
    let releaseMutex: (()=>void) | null = null;
    if (module.StateClass) {
      const cmdName = module.metadata.name;
      state = this.stateManager.getOrCreateState(cmdName, execCtx.ctx, module.StateClass, module.getPersistencePath);
      if (!this.stateManager.hasState(cmdName, execCtx.ctx)) {
        await this.stateManager.restoreState(cmdName, execCtx.ctx, module.StateClass, module.getPersistencePath);
      }
      if (state.mutex) {
        releaseMutex = await state.mutex.lock();
      }
    }
    return { state, releaseMutex };
  }

  private async runCommandPhases(module: CommandModule, args: any, execCtx: ExecutionContext, state: any, startTime: number): Promise<CommandResult> {
    const ctx = state ? { ...execCtx.ctx, commandState: state } : execCtx.ctx;
    if (module.beforeExecute) await module.beforeExecute(args, ctx);
    let result: CommandResult;
    try {
      result = await module.execute(args, execCtx.ctx.cwd ?? process.cwd(), execCtx.signal, ctx);
    } catch (err) {
      result = { code: 1, stdout: "", stderr: err instanceof Error ? err.message : String(err), data: undefined };
    }
    if (module.afterExecute) {
      try { await module.afterExecute(result, ctx); } catch (e) { console.error(`afterExecute hook failed for ${module.metadata.name}:`, e); }
    }
    if (state && state.isDirty && module.StateClass) {
      this.stateManager.saveStateIfDirty(module.metadata.name, execCtx.ctx).catch(console.error);
    }
    this.enforceOutputLimits(result, execCtx.maxOutputSize);
    if (this.enableAudit) {
      this.logAudit({
        timestamp: Date.now(),
        toolCallId: execCtx.toolCallId,
        command: module.metadata.name,
        success: result.code === 0,
        durationMs: Date.now() - startTime,
        error: result.code !== 0 ? result.stderr : undefined,
        argsSize: JSON.stringify(args).length,
        outputSize: (result.stdout?.length ?? 0) + (result.stderr?.length ?? 0)
      });
    }
    return result;
  }

  private enforceOutputLimits(result: CommandResult, maxSize: number): void {
    const validation = this.validator.validateResult(result, maxSize);
    if (!validation.valid) {
      result.stderr = (result.stderr ? result.stderr + "\n" : "") + `Warning: ${validation.errors.join(', ')}`;
      if (result.stdout.length > maxSize) result.stdout = result.stdout.substring(0, maxSize) + "\n... (truncated)";
      if (result.stderr.length > maxSize) result.stderr = result.stderr.substring(0, maxSize) + "\n... (truncated)";
    }
  }

  private handleLoadError(error: any, entry: CommandRegistryEntry, commandName: string): CommandResult {
    const msg = error instanceof Error ? error.message : String(error);
    entry.errorCount++;
    entry.lastError = msg;
    this.cache.markError(commandName, msg);
    return this.makeErrorResult(msg, "execution_error", { stack: error instanceof Error ? error.stack : undefined });
  }

  private handleExecutionError(error: any, entry: CommandRegistryEntry, commandName: string, execCtx: ExecutionContext, startTime: number): Promise<CommandResult> {
    const msg = error instanceof Error ? error.message : String(error);
    if (this.enableAudit) {
      this.logAudit({
        timestamp: Date.now(),
        toolCallId: execCtx.toolCallId,
        command: commandName,
        success: false,
        durationMs: Date.now() - startTime,
        error: msg,
        argsSize: 0,
        outputSize: 0
      });
    }
    return Promise.resolve(this.makeErrorResult(msg, "execution_error", { stack: error instanceof Error ? error.stack : undefined }));
  }
}
