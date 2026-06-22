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

  constructor(options: MasterToolOptions = {}) {
    this.options = { ...DEFAULT_MASTER_TOOL_OPTIONS, ...options };
    this.cache = new CommandCache({
      ttl: this.options.cacheTTL,
      maxSize: 200
    });
    this.validator = getValidator({ rateLimitPerMinute: this.options.rateLimitPerMinute });
    this.enableAudit = this.options.enableAudit ?? false;
    this.stateManager = new StateManager();
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
    let module: CommandModule | undefined;
    let state: any = null;
    let releaseMutex: (() => void) | null = null;

    try {
      // 1. Load module (from cache or dynamic import)
      module = await this.loadModule(commandName, entry);

      // 2. Rate limit check
      const rateLimit = this.validator.checkRateLimit(commandName);
      if (!rateLimit.allowed) {
        return this.makeErrorResult(
          `Rate limit exceeded. Reset in ${rateLimit.resetIn}s`,
          "rate_limit_exceeded"
        );
      }

      // 3. Schema validation
      const schemaValidation = this.validator.validateWithSchema(args, module.schema, commandName);
      if (!schemaValidation.valid) {
        const errors = schemaValidation.errors?.map(e => `${e.path?.join('.') || ''}: ${e.message}`).join('; ') || 'Invalid arguments';
        return this.makeErrorResult(`Validation failed: ${errors}`, "validation_failed", { validationErrors: schemaValidation.errors });
      }

      // 4. Security validation
      const securityValidation = this.validator.validateSecurity(args, module.metadata);
      if (!securityValidation.valid) {
        return this.makeErrorResult(`Security: ${securityValidation.errors.join(', ')}`, "security_error");
      }

      // 5. State management (NEW)
      if (module.StateClass) {
        // Get or create state instance
        state = this.stateManager.getOrCreateState(
          commandName,
          execCtx.ctx,
          module.StateClass,
          module.getPersistencePath
        );

        // Restore if fresh
        if (!this.stateManager.hasState(commandName, execCtx.ctx)) {
          await this.stateManager.restoreState(commandName, execCtx.ctx, module.StateClass, module.getPersistencePath);
        }

        // Lock mutex if state has one
        if (state.mutex) {
          releaseMutex = await state.mutex.lock();
        }
      }

      // 6. Before hook (with injected state if available)
      const ctxWithState = state ? { ...execCtx.ctx, commandState: state } : execCtx.ctx;
      if (module.beforeExecute) {
        await module.beforeExecute(args, ctxWithState);
      }

      // 7. Execute command (with state injected)
      let result: CommandResult;
      try {
        result = await module.execute(args, execCtx.ctx.cwd ?? process.cwd(), execCtx.signal, ctxWithState);
      } catch (error: any) {
        result = {
          code: 1,
          stdout: "",
          stderr: error instanceof Error ? error.message : String(error),
          data: undefined
        };
      }

      // 8. After hook
      if (module.afterExecute) {
        try {
          await module.afterExecute(result, ctxWithState);
        } catch (e: any) {
          console.error(`afterExecute hook failed for ${commandName}:`, e);
        }
      }

      // 9. Auto-save if state dirty (NEW)
      if (state && state.isDirty && module.StateClass) {
        // Fire-and-forget
        this.stateManager.saveStateIfDirty(commandName, execCtx.ctx).catch(console.error);
      }

      // 10. Validate output size
      const outputValidation = this.validator.validateResult(result, execCtx.maxOutputSize);
      if (!outputValidation.valid) {
        result.stderr = (result.stderr ? result.stderr + "\n" : "") + `Warning: ${outputValidation.errors.join(', ')}`;
        if (result.stdout.length > execCtx.maxOutputSize) {
          result.stdout = result.stdout.substring(0, execCtx.maxOutputSize) + "\n... (truncated)";
        }
        if (result.stderr.length > execCtx.maxOutputSize) {
          result.stderr = result.stderr.substring(0, execCtx.maxOutputSize) + "\n... (truncated)";
        }
      }

      // 11. Audit log
      if (this.enableAudit) {
        this.logAudit({
          timestamp: Date.now(),
          toolCallId: execCtx.toolCallId,
          command: commandName,
          success: result.code === 0,
          durationMs: Date.now() - startTime,
          error: result.code !== 0 ? result.stderr : undefined,
          argsSize: JSON.stringify(args).length,
          outputSize: (result.stdout?.length ?? 0) + (result.stderr?.length ?? 0)
        });
      }

      // 12. Update cache entry success
      entry.loadCount++;
      entry.lastLoaded = Date.now();

      return result;

    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);

      // Audit failure
      if (this.enableAudit) {
        this.logAudit({
          timestamp: Date.now(),
          toolCallId: execCtx.toolCallId,
          command: commandName,
          success: false,
          durationMs: Date.now() - startTime,
          error: msg,
          argsSize: JSON.stringify(args).length,
          outputSize: 0
        });
      }

      // Mark cache entry error (if module load failed)
      if (module === undefined && entry) {
        entry.errorCount++;
        entry.lastError = msg;
        this.cache.markError(commandName, msg);
      }

      return this.makeErrorResult(msg, "execution_error", { stack: error instanceof Error ? error.stack : undefined });
    } finally {
      // Release mutex if acquired
      if (releaseMutex) {
        releaseMutex();
      }
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
  } {
    const totalExecutions = this.auditLogs.length;
    const successful = this.auditLogs.filter(l => l.success).length;
    const successRate = totalExecutions > 0 ? (successful / totalExecutions) * 100 : 0;

    // Group errors by command
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

    return {
      registeredCommands: this.registry.size,
      cacheStats: this.cache.getStats(),
      recentErrors: Array.from(errorMap.entries())
        .map(([command, data]) => ({ command, error: data.lastError, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      totalExecutions,
      successRate: Math.round(successRate * 10) / 10
    };
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
}
