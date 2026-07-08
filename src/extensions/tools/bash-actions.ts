#!/usr/bin/env node

/**
 * Bash Action - Minimal, powerful.
 * Two actions: shell (arbitrary bash) + glob (find files).
 */

import type { ExtensionAPI, ToolDefinition, Theme, AgentToolResult, AgentToolUpdateCallback, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createBashToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import crypto from "crypto";

// ============================================================================
// 1. TYPES
// ============================================================================

export interface BashAction {
  name: string;
  description: string;
  schema: any;
  buildCommand: (args: any) => string;
  render?: (result: BashResult, theme: Theme, options?: any) => any;
  options?: {
    cache?: { ttl: number };
    rateLimit?: { max: number; windowMs: number };
    timeout?: number;
  };
}

export interface BashResult {
  stdout: string;
  stderr: string;
  code: number;
  duration: number;
  cached?: boolean;
}

interface Metrics {
  count: number;
  totalDuration: number;
  avgDuration: number;
  errors: number;
  lastError?: string;
  lastRun?: number;
}

interface CacheEntry {
  result: BashResult;
  expires: number;
}

// ============================================================================
// 2. DATA STRUCTURES
// ============================================================================

class SimpleLRUCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 60000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get(key: string): BashResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.result;
  }

  set(key: string, result: BashResult, ttl?: number): void {
    if (ttl === 0) return; // caching disabled
    const expires = Date.now() + (ttl ?? this.defaultTTL);
    const entry: CacheEntry = { result, expires };
    if (this.cache.has(key)) this.cache.delete(key);
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, entry);
  }

  size(): number { return this.cache.size; }
  clear(): void { this.cache.clear(); }
}

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly intervalMs: number;

  constructor(capacity: number, tokensPerInterval: number, intervalMs: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.refillRate = tokensPerInterval / intervalMs;
    this.intervalMs = intervalMs;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    if (timePassed > 0) {
      const tokensToAdd = timePassed * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  tryRemoveTokens(amount: number = 1): boolean {
    this.refill();
    if (this.tokens >= amount) {
      this.tokens -= amount;
      return true;
    }
    return false;
  }
}

// ============================================================================
// 3. BASH ACTION EXECUTOR (Class)
// ============================================================================

export class BashActionExecutor {
  private actions = new Map<string, BashAction>();
  private bashTool: any;
  private cache: SimpleLRUCache;
  private metrics = new Map<string, Metrics>();
  private rateLimiters = new Map<string, TokenBucket>();
  private ctx: ExtensionContext;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(ctx: ExtensionContext, options: { cacheSize?: number; cacheDefaultTTL?: number } = {}) {
    this.ctx = ctx;
    this.cache = new SimpleLRUCache(
      options.cacheSize || 1000,
      options.cacheDefaultTTL || 60000
    );
    const cwd = ctx.cwd || process.cwd();
    this.bashTool = createBashToolDefinition(cwd, { commandPrefix: "" });
  }

  registerAction(action: BashAction): void {
    if (this.actions.has(action.name)) {
      throw new Error(`Action "${action.name}" already registered`);
    }
    this.actions.set(action.name, action);
    this.metrics.set(action.name, { count: 0, totalDuration: 0, avgDuration: 0, errors: 0 });
    if (action.options?.rateLimit) {
      this.rateLimiters.set(action.name, new TokenBucket(
        action.options.rateLimit.max,
        action.options.rateLimit.max,
        action.options.rateLimit.windowMs
      ));
    }
  }

  async execute(
    actionName: string,
    args: any,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback<any>
  ): Promise<BashResult> {
    const action = this.actions.get(actionName);
    if (!action) {
      throw new Error(`Unknown action: ${actionName}. Available: ${Array.from(this.actions.keys()).join(', ')}`);
    }

    const startTime = Date.now();
    const cacheKey = `${actionName}:${crypto.createHash('md5').update(JSON.stringify(args)).digest('hex')}`;

    try {
      // Cache check
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.cacheHits++;
        this.updateMetrics(actionName, Date.now() - startTime, false);
        return { ...cached, cached: true };
      }
      this.cacheMisses++;

      // Rate limit
      if (action.options?.rateLimit) {
        const limiter = this.rateLimiters.get(actionName);
        if (limiter && !limiter.tryRemoveTokens(1)) {
          throw new Error(`Rate limit exceeded for action "${actionName}"`);
        }
      }

      // Validate args
      const validationResult = this.validateArgs(args, action.schema);
      if (!validationResult.valid) {
        const errors = (validationResult.errors || []).map((e: any) => `${e.path || ''}: ${e.message}`).join('; ');
        throw new Error(`Validation failed: ${errors}`);
      }

      // Build command
      const command = action.buildCommand(args);
      if (!command || typeof command !== 'string') {
        throw new Error(`Action "${actionName}" returned invalid command`);
      }

      // Timeout handling
      const timeoutMs = action.options?.timeout || 30000;
      let timeoutId: NodeJS.Timeout | null = null;
      if (signal) {
        timeoutId = setTimeout(() => signal.dispatchEvent(new Event('abort')), timeoutMs);
      }

      // Execute
      const toolCallId = `bash-${actionName}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result: any = await this.bashTool.execute(toolCallId, { command }, signal, onUpdate, this.ctx);
      if (timeoutId) clearTimeout(timeoutId);

      if (result.isError) {
        throw new Error(result.content[0]?.text || `Command failed with exit code ${result.details?.code || 1}`);
      }

      const stdout = result.content.map((c: any) => c.text).join('\n');
      const bashResult: BashResult = {
        stdout,
        stderr: result.details?.stderr || '',
        code: result.details?.code || 0,
        duration: Date.now() - startTime
      };

      // Cache if successful
      if (action.options?.cache && bashResult.code === 0) {
        this.cache.set(cacheKey, bashResult, action.options.cache.ttl);
      }

      this.updateMetrics(actionName, bashResult.duration, false);
      return bashResult;

    } catch (error: any) {
      this.updateMetrics(actionName, Date.now() - startTime, true, error.message);
      throw error;
    }
  }

  private validateArgs(args: any, schema: any): { valid: boolean; errors?: Array<{ path?: string; message: string }> } {
    if (!schema) return { valid: true };
    try {
      const errors: Array<{ path?: string; message: string }> = [];
      const required = schema.required || [];
      for (const field of required) {
        if (args[field] === undefined) errors.push({ path: field, message: 'Required' });
      }
      const props = schema.properties || {};
      for (const [key, typeDefRaw] of Object.entries(props) as [string, any][]) {
        if (args[key] === undefined) continue;
        const value = args[key];
        const typeDef = typeDefRaw as any;
        const type = typeDef.type;
        if (type === 'string' && typeof value !== 'string') errors.push({ path: key, message: 'Must be string' });
        else if (type === 'number' && typeof value !== 'number') errors.push({ path: key, message: 'Must be number' });
        else if (type === 'boolean' && typeof value !== 'boolean') errors.push({ path: key, message: 'Must be boolean' });
        else if (type === 'integer' && !Number.isInteger(value)) errors.push({ path: key, message: 'Must be integer' });
        else if (typeDef.enum && !typeDef.enum.includes(value)) errors.push({ path: key, message: `Must be one of: ${typeDef.enum.join(', ')}` });
        else if (typeDef.minimum !== undefined && value < typeDef.minimum) errors.push({ path: key, message: `>= ${typeDef.minimum}` });
        else if (typeDef.maximum !== undefined && value > typeDef.maximum) errors.push({ path: key, message: `<= ${typeDef.maximum}` });
      }
      return { valid: errors.length === 0, errors };
    } catch (e) {
      return { valid: false, errors: [{ message: String(e) }] };
    }
  }

  private updateMetrics(actionName: string, duration: number, isError: boolean, errorMsg?: string): void {
    const m = this.metrics.get(actionName);
    if (!m) return;
    m.count++;
    m.totalDuration += duration;
    m.avgDuration = m.count > 0 ? m.totalDuration / m.count : 0;
    if (isError) { m.errors++; m.lastError = errorMsg; }
    m.lastRun = Date.now();
  }

  getMetrics(actionName?: string): any {
    if (actionName) {
      const m = this.metrics.get(actionName);
      return m ? { ...m } : null;
    }
    const all: any = {};
    for (const [name, m] of this.metrics) {
      all[name] = { ...m };
    }
    return all;
  }

  getStats(): any {
    return {
      totalActions: this.actions.size,
      cacheSize: this.cache.size(),
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: this.cacheHits + this.cacheMisses > 0 ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100 : 0,
      actions: Array.from(this.actions.keys()),
      metrics: this.getMetrics()
    };
  }

  listActions(): BashAction[] {
    return Array.from(this.actions.values());
  }

  getAction(name: string): BashAction | undefined {
    return this.actions.get(name);
  }

  removeAction(name: string): BashAction | undefined {
    this.metrics.delete(name);
    this.rateLimiters.delete(name);
    return this.actions.delete(name) ? this.actions.get(name) : undefined;
  }

  getHelp(actionName?: string): string {
    if (actionName) {
      const action = this.actions.get(actionName);
      if (!action) return `Action "${actionName}" not found`;
      const lines: string[] = [`=== ${actionName} ===`, `\nDescription: ${action.description}`];
      if (action.schema?.properties) {
        lines.push("\nArguments:");
        const props = action.schema.properties as Record<string, any>;
        const required = action.schema.required || [];
        for (const [key, prop] of Object.entries(props)) {
          const req = required.includes(key) ? '*' : '';
          lines.push(`  ${key}${req} (${prop.type || 'any'}): ${prop.description || ''}`);
        }
      }
      const m = this.metrics.get(actionName);
      if (m) lines.push(`\nMetrics: runs=${m.count}, avg=${Math.round(m.avgDuration)}ms, errors=${m.errors}`);
      if (action.options) {
        lines.push("\nOptions:");
        if (action.options.cache) lines.push(`  Cache: TTL=${action.options.cache.ttl}ms`);
        if (action.options.rateLimit) lines.push(`  Rate limit: ${action.options.rateLimit.max}/${action.options.rateLimit.windowMs}ms`);
        if (action.options.timeout) lines.push(`  Timeout: ${action.options.timeout}ms`);
      }
      return lines.join('\n');
    }
    let output = `Bash Action (${this.actions.size} actions):\n\n`;
    for (const action of this.actions.values()) {
      const m = this.metrics.get(action.name);
      output += `• ${action.name.padEnd(15)} ${action.description}`;
      if (m) output += ` [${m.count} runs]`;
      output += '\n';
    }
    output += '\nUse bash_action({ action: "<name>", args: {...} })';
    return output;
  }
}

// ============================================================================
// 4. TOOL DEFINITION
// ============================================================================

let actionExecutor: BashActionExecutor | null = null;

export function createBashActionTool(): ToolDefinition {
  return {
    name: "bash_action",
    label: "Bash Action",
    description:
      "Execute bash commands and find files. " +
      "shell: arbitrary bash (rate limited 5/min, no cache). " +
      "glob: find files by pattern (cached 10s). " +
      "Use 'shell' with caution - runs ANY command!",
    promptSnippet: `
# Bash Action - Minimal bash executor
bash_action({ action: 'shell', args: { command: 'ls -la' } })
bash_action({ action: 'glob', args: { pattern: '**/*.ts' } })
`,
    promptGuidelines: [
      "=== BASH ACTION ===",
      "Bash command executor. Two built-in actions:",
      "",
      "🔹 action: 'shell'",
      "   Execute arbitrary bash command.",
      "   Args: { command: string, timeout?: number (ms, default 30000) }",
      "   ⚠️  WARNING: Rate limited 5/min, NO cache, can run ANY command!",
      "   Example: bash_action({ action: 'shell', args: { command: 'ls -la' } })",
      "",
      "🔹 action: 'glob'",
      "   Find files by glob pattern.",
      "   Args: { pattern: string (e.g., '**/*.ts'), path?: string (default: cwd) }",
      "   ✓ Safe, cached 10s, timeout 15s.",
      "   Example: bash_action({ action: 'glob', args: { pattern: 'src/**/*.ts' } })",
      "",
      "🔹 action: 'list'",
      "   List all available actions (no args).",
      "",
      "🔹 action: 'stats'",
      "   Show framework metrics (cache hit rate, per-action stats).",
      "",
      "=== DISCOVERY ===",
      "To see all actions: bash_action({ action: 'list', args: {} })",
      "To see help for one action: bash_action({ action: 'shell', args: {} })",
      "To see stats: bash_action({ action: 'stats', args: {} })",
      "",
      "=== OUTPUT FORMAT ===",
      "Success: { content: [{type:'text', text: stdout}], details: {action, duration, code, cached?}, isError: false }",
      "Error:   { content: [{type:'text', text: '❌ ...'}], details: {action, error}, isError: true }",
      "",
      "=== EXTENDING ===",
      "To add custom actions, use BashActionExecutor.registerAction({ name, description, schema, buildCommand, options? }).",
      "",
      "=== WARNINGS ===",
      "⚠️  Never run shell commands from untrusted sources.",
      "⚠️  shell action: rate limited, no cache - design for this!",
      "✓ glob action: safe, cache aggressively for performance.",
      "",
      "=== QUICK EXAMPLES ===",
      "Echo:     bash_action({ action: 'shell', args: { command: 'echo Hello' } })",
      "Find .ts: bash_action({ action: 'glob', args: { pattern: '**/*.ts' } })",
      "List all: bash_action({ action: 'list', args: {} })",
      "Metrics:  bash_action({ action: 'stats', args: {} })",
      "",
      "Use extreme caution with shell action."
    ],
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", description: "Action name: 'shell', 'glob', 'list', 'stats'." },
        args: { type: "object", description: "Action arguments." }
      },
      required: ["action", "args"]
    },

    async execute(
      toolCallId: string,
      params: { action: string; args: Record<string, any> },
      signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback<any> | undefined,
      ctx: ExtensionContext
    ): Promise<AgentToolResult<any>> {
      const { action, args } = params;

      if (!actionExecutor) {
        actionExecutor = new BashActionExecutor(ctx, { cacheSize: 1000, cacheDefaultTTL: 60000 });
        registerBuiltinActions(actionExecutor);
      }

      if (action === 'list') {
        return {
          content: [{ type: "text", text: actionExecutor.getHelp() }],
          details: { actions: actionExecutor.listActions() },
          isError: false
        };
      }

      if (action === 'stats') {
        const stats = actionExecutor.getStats();
        const text = [
          `Bash Action Stats`,
          `Actions: ${stats.totalActions}`,
          `Cache: ${stats.cacheSize} (hits ${stats.cacheHits}, miss ${stats.cacheMisses}, rate ${stats.cacheHitRate.toFixed(1)}%)`
        ].join('\n');
        return { content: [{ type: "text", text }], details: stats, isError: false };
      }

      if (Object.keys(args).length === 0 && actionExecutor.getAction(action)) {
        return { content: [{ type: "text", text: actionExecutor.getHelp(action) }], details: { action }, isError: false };
      }

      try {
        const result = await actionExecutor.execute(action, args, signal, onUpdate);
        return {
          content: [{ type: "text", text: result.stdout }],
          details: { action, duration: result.duration, code: result.code, cached: result.cached, stderr: result.stderr },
          isError: result.code !== 0
        };
      } catch (error: any) {
        return { content: [{ type: "text", text: `❌ ${error.message}` }], details: { action, error: error.message }, isError: true };
      }
    },

    renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, _context?: any): any {
      const details = result.details || {};
      const lines: string[] = [];
      if (options.isPartial) return new Text(`Executing ${details.action || '...'}`);
      if (result.isError) return new Text(`❌ ${details.action || 'Error'}: ${details.error || ''}`);
      if (details.cached) lines.push(theme.fg('dim', '[CACHED]'));
      if (details.duration) lines.push(theme.fg('dim', `${details.duration}ms`));
      if (result.content?.[0]?.text) lines.push(result.content[0].text);
      return new Text(lines.join('\n'));
    }
  };
}

// ============================================================================
// 5. BUILTIN ACTIONS
// ============================================================================

// Import glob action
import { schema as globSchema, buildCommand as globBuildCommand, render as globRender } from './bash-actions/glob-action.js';

function registerBuiltinActions(executor: BashActionExecutor): void {
  // SHELL - arbitrary bash
  executor.registerAction({
    name: 'shell',
    description: '⚠️  DANGEROUS: Execute arbitrary bash command. Rate limited 5/min, timeout 30s.',
    schema: Type.Object({
      command: Type.String({ description: 'Any bash command' }),
      timeout: Type.Optional(Type.Number({ description: 'Override timeout (ms)' }))
    }),
    buildCommand: (args) => args.command,
    options: { cache: { ttl: 0 }, rateLimit: { max: 5, windowMs: 60000 }, timeout: 30000 }
  });

  // GLOB - find files
  executor.registerAction({
    name: 'glob',
    description: 'Find files by glob pattern (supports **). Cached 10s, timeout 15s.',
    schema: globSchema,
    buildCommand: globBuildCommand,
    render: globRender,
    options: { cache: { ttl: 10000 }, timeout: 15000 }
  });
}

// ============================================================================
// 6. REGISTRATION
// ============================================================================

export function registerBashAction(api: ExtensionAPI): void {
  const tool = createBashActionTool();
  api.registerTool(tool);
}

export default {
  registerBashAction,
  BashActionExecutor,
  createBashActionTool
};
