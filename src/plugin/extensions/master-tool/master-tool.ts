#!/usr/bin/env node

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MASTER TOOL                                      ║
 * ║              HỆ THỐNG HÀNG TRĂM COMMANDS TRONG 1 TOOL                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * Tính năng:
 * - Auto-discover commands từ thư mục commands/
 * - Dynamic import + cache (LRU + TTL)
 * - Validation (TypeBox schema)
 * - Rate limiting (optional)
 * - Audit logging
 * - Security checks (prototype pollution, size limits)
 * - Per-command custom renderer
 * - Category organization
 * - Search & filter
 * - Metrics & monitoring
 * - Stateful command support (optional)
 *
 * USAGE:
 *   master_tool({ command: 'git.status', args: {} })
 *   master_tool({ command: 'dev.test', args: { files: ['src/'] } })
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
  Theme,
  AgentToolResult,
  AgentToolUpdateCallback
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { CommandRegistry } from "./command-registry.js";
import { DEFAULT_MASTER_TOOL_OPTIONS } from "./types/command-module.js";

// ============================================================================
// 1. GLOBAL REGISTRY (singleton per extension instance)
// ============================================================================

let globalRegistry: CommandRegistry | null = null;

function getRegistry(options?: any): CommandRegistry {
  if (!globalRegistry) {
    globalRegistry = new CommandRegistry(options);
  }
  return globalRegistry;
}

function resetRegistry(): void {
  globalRegistry = null;
}

export { getRegistry, resetRegistry };

// ============================================================================
// 2. TOOL DEFINITION
// ============================================================================

export function createMasterTool(options: any = {}): ToolDefinition {
  const registry = getRegistry(options);

  return {
    name: "plugin.master_tool",
    label: "Master Tool",
    description:
      "Unified access to hundreds of specialized commands. " +
      "Commands are auto-discovered from the commands/ directory. " +
      "Supports git operations, dev workflows, system info, and more. " +
      "Use 'list' command to see all available.",
    promptSnippet: "master_tool({ command: '<name>', args: {...} })",
    promptGuidelines: [
      "The master tool provides access to many specialized commands.",
      "",
      "**Structure**:",
      "  master_tool({",
      "    command: 'category.action',  // e.g., 'git.status', 'dev.test'",
      "    args: { ... }               // command-specific arguments",
      "  })",
      "",
      "**Discover commands**:",
      "  • List all: master_tool({ command: 'list', args: {} })",
      "  • By category: master_tool({ command: 'list.grep', args: { category: 'git' } })",
      "  • Search: master_tool({ command: 'list.grep', args: { query: 'test' } })",
      "  • Get help: master_tool({ command: 'help', args: { command: 'git.status' } })",
      "",
      "**Examples**:",
      "  • Git status:",
      "    master_tool({ command: 'git.status', args: {} })",
      "",
      "  • Run tests:",
      "    master_tool({ command: 'dev.test', args: { files: ['src/'], coverage: true } })",
      "",
      "  • System info:",
      "    master_tool({ command: 'system.info', args: { detailed: true } })",
      "",
      "**Categories**: git, dev, system, codebase, security, team, etc.",
      "",
      "**Features**:",
      "  • Auto-validation of arguments (TypeBox schemas)",
      "  • Rate limiting (configurable)",
      "  • Output size limits (1MB default)",
      "  • Security checks (prototype pollution, injection)",
      "  • Audit logging",
      "  • Command caching (LRU, 5min TTL)",
      "  • Stateful command support (persistence, mutex)",
      "  • Custom renderer per command"
    ],
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Command name (e.g., 'git.status', 'dev.test'). Use 'list' to see all."
        },
        args: {
          type: "object",
          description: "Command-specific arguments. See command help for details."
        }
      },
      required: ["command", "args"]
    },

    async execute(
      toolCallId: string,
      params: any,
      signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      ctx: ExtensionContext
    ): Promise<AgentToolResult<any>> {
      try {
        await registry.ensureInitialized();
      } catch (error) {
        return {
          content: [{ type: "text", text: `❌ Failed to initialize command registry: ${error}` }],
          details: { error: "registry_init_failed" },
          isError: true
        };
      }

      const { command, args } = params;

      if (!command || typeof command !== "string") {
        return {
          content: [{ type: "text", text: "❌ Missing required parameter: command" }],
          details: { error: "missing_command" },
          isError: true
        };
      }

      // Special meta-commands (list, help, stats, reload)
      if (command === "list" || command === "list.grep" || command === "help" || command === "stats" || command === "reload") {
        return handleMetaCommand(command, args, ctx);
      }

      // Execute actual command
      const result = await registry.execute(command, args ?? {}, {
        toolCallId,
        signal,
        onUpdate,
        ctx,
        maxOutputSize: options.maxOutputSize ?? 1024 * 1024
      });

      // Transform to AgentToolResult
      return {
        content: result.content,
        details: result.details,
        isError: result.isError
      };
    },

    // ========================================================================
    // RENDER CALL - Shows which command is executing
    // ========================================================================
    renderCall(args: any, theme: Theme): any {
      const command = args.command || "master_tool";
      const commandPart = theme.fg("accent", command);
      const argsPreview = Object.keys(args.args ?? {}).length > 0
        ? theme.fg("dim", `(${Object.keys(args.args).length} args)`)
        : "";

      return new Text(
        `${theme.fg("toolTitle", theme.bold("master_tool"))} ${commandPart} ${argsPreview}`,
        0,
        0
      );
    },

    // ========================================================================
    // RENDER RESULT - Default renderer (can be overridden per command)
    // ========================================================================
    renderResult(
      result: AgentToolResult<any>,
      options: { expanded: boolean; isPartial: boolean },
      theme: Theme,
      context?: any
    ): any {
      const details = result.details || {};
      const isError = result.isError;
      const command = details.command || "unknown";

      // If partial (executing), show spinner
      if (options.isPartial) {
        return new Text(theme.fg("warning", `⏳ Executing ${command}...`));
      }

      // If error
      if (isError) {
        const lines = [
          theme.fg("error", `❌ ${command} failed`),
          details.error ? theme.fg("muted", details.error) : ""
        ].filter(Boolean);
        return new Text(lines.join("\n"));
      }

      // Success - check if command has custom renderer already applied
      // The command's own renderResult would have been called by executor
      // This is fallback if command doesn't have custom renderer
      const lines: string[] = [];

      if (details.code !== undefined) {
        const status = details.code === 0 ? "success" : "warning";
        lines.push(theme.fg(status, `✓ ${command} completed (exit ${details.code})`));
      }

      if (details.duration !== undefined) {
        lines.push(theme.fg("dim", `Duration: ${details.duration}ms`));
      }

      // Show stdout truncated
      const stdoutText = result.content
        .filter(c => c.type === "text")
        .map(c => c.text)
        .join("\n")
        .trim();

      if (stdoutText) {
        const maxPreview = options.expanded ? 50 : 10;
        const linesArr = stdoutText.split('\n');
        if (linesArr.length > maxPreview) {
          const preview = linesArr.slice(0, maxPreview).join('\n');
          lines.push(theme.fg("text", preview));
          lines.push(theme.fg("dim", `... and ${linesArr.length - maxPreview} more lines`));
        } else {
          lines.push(theme.fg("text", stdoutText));
        }
      }

      return new Text(lines.join("\n"));
    }
  };
}

// ============================================================================
// 3. META-COMMAND HANDLERS
// ============================================================================

function handleListCommand(registry: CommandRegistry, args: any): AgentToolResult<any> {
  const commands = registry.getCommandList();
  const categories = registry.getExecutor().listCommandsByCategory();

  let output = `📋 Available Commands (${commands.length} total)\n\n`;

  for (const [category, cmds] of categories.entries()) {
    output += `${category} (${cmds.length}):\n`;
    for (const cmd of cmds) {
      const cmdInfo = commands.find(c => c.name === cmd);
      const desc = cmdInfo?.description || "No description";
      output += `  • ${cmd.padEnd(30)} ${desc}\n`;
    }
    output += "\n";
  }

  output += "Usage: master_tool({ command: 'category.action', args: {...} })\n";
  output += "Help: master_tool({ command: 'help', args: { command: 'name' } })";

  return {
    content: [{ type: "text", text: output }],
    details: { commands, categories: Object.fromEntries(categories) },
    isError: false
  };
}

function handleGrepCommand(registry: CommandRegistry, args: any): AgentToolResult<any> {
  const { query, category } = args;
  const commands = registry.getCommandList();

  const filtered = commands.filter(cmd => {
    const matchesQuery = query
      ? cmd.name.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description.toLowerCase().includes(query.toLowerCase())
      : true;
    const matchesCategory = category ? cmd.category === category : true;
    return matchesQuery && matchesCategory;
  });

  let output = `🔍 Found ${filtered.length} commands`;
  if (query) output += ` matching "${query}"`;
  if (category) output += ` in category "${category}"`;
  output += ":\n\n";

  for (const cmd of filtered) {
    output += `  • ${cmd.name}\n    ${cmd.description}\n\n`;
  }

  return {
    content: [{ type: "text", text: output }],
    details: { query, category, count: filtered.length, commands: filtered },
    isError: false
  };
}

function handleHelpCommand(registry: CommandRegistry, args: any): AgentToolResult<any> {
  const { command } = args;

  if (!command) {
    return {
      content: [{ type: "text", text: "❌ Missing command parameter. Usage: master_tool({ command: 'help', args: { command: 'name' } })" }],
      details: { error: "missing_command" },
      isError: true
    };
  }

  const helpText = registry.getCommandHelp(command);
  if (!helpText) {
    return {
      content: [{ type: "text", text: `❌ Command not found: ${command}` }],
      details: { error: "command_not_found" },
      isError: true
    };
  }

  return {
    content: [{ type: "text", text: helpText }],
    details: { command },
    isError: false
  };
}

function handleStatsCommand(registry: CommandRegistry): AgentToolResult<any> {
  const stats = registry.getStats();

  let output = `📊 Master Tool Statistics\n\n`;
  output += `Registered commands: ${stats.registeredCommands}\n`;
  output += `Total executions: ${stats.totalExecutions}\n`;
  output += `Success rate: ${stats.successRate}%\n\n`;

  output += `Cache:\n`;
  output += `  Size: ${stats.cacheStats.size} entries\n`;
  output += `  Entries:\n`;
  for (const entry of stats.cacheStats.entries.slice(0, 5)) {
    output += `    - ${entry.name} (hits: ${entry.loadCount}, age: ${Math.round(entry.ageMs/1000)}s)\n`;
  }

  if (stats.recentErrors.length > 0) {
    output += `\n⚠️  Recent Errors:\n`;
    for (const err of stats.recentErrors.slice(0, 5)) {
      output += `  • ${err.command}: ${err.error} (${err.count}x)\n`;
    }
  }

  return {
    content: [{ type: "text", text: output }],
    details: stats,
    isError: false
  };
}

function handleReloadCommand(registry: CommandRegistry, ctx: ExtensionContext): AgentToolResult<any> {
  // Clear command cache
  const executor = registry.getExecutor();
  const cache = (executor as any)["getCache"]?.();
  if (cache) {
    cache.clear();
  }
  // Also could trigger full reload, but cache clear is sufficient for meta-command
  return {
    content: [{ type: "text", text: "✅ Caches cleared. Runtime reload may be needed for full effect." }],
    details: { action: "cache_cleared" },
    isError: false
  };
}

function handleMetaCommand(
  command: string,
  args: any,
  ctx: ExtensionContext
): AgentToolResult<any> {
  const registry = getRegistry();

  switch (command) {
    case "list":
      return handleListCommand(registry, args);
    case "list.grep":
      return handleGrepCommand(registry, args);
    case "help":
      return handleHelpCommand(registry, args);
    case "stats":
      return handleStatsCommand(registry);
    case "reload":
      return handleReloadCommand(registry, ctx);
    default:
      return {
        content: [{ type: "text", text: `❌ Unknown meta-command: ${command}. Use 'list', 'help', 'stats', 'reload'` }],
        details: { error: "unknown_meta_command" },
        isError: true
      };
  }
}

// ============================================================================
// 4. REGISTRATION
// ============================================================================

export function registerMasterTool(api: ExtensionAPI, customOptions?: any): void {
  const options = { ...DEFAULT_MASTER_TOOL_OPTIONS, ...customOptions };
  const tool = createMasterTool(options);

  // Register as tool
  api.registerTool(tool);

  // Also make available as capability (optional)
  // If api has getCapabilityRegistry, we could register there too
  // But for now, it's just a tool
}

// ============================================================================
// 5. EXPORT FOR COMMAND MODULES
// ============================================================================

// Re-export commonly used types for command developers
export type {
  CommandModule,
  CommandMetadata,
  CommandResult,
  CommandLoader,
  MasterToolOptions
} from "./types/command-module.js";

// Export createCommandRegistry for external use (if needed)
export { createCommandRegistry } from "./command-registry.js";

// Export utilities
export { CommandCache } from "./utils/command-cache.js";
export { CommandValidator, getValidator } from "./utils/command-validator.js";

export default {
  registerMasterTool,
  createMasterTool,
  getRegistry: () => globalRegistry
};
