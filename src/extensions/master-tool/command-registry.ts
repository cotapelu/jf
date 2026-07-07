#!/usr/bin/env node

/**
 * Command Registry
 *
 * Tự động scan thư mục commands/ và load command metadata.
 * Hỗ trợ lazy loading, category organization, command discovery.
 */

import { readdir, stat } from "fs/promises";
import { join, extname, basename, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  CommandModule,
  CommandMetadata,
  // CommandRegistryEntry unused - removed
  CommandLoader,
  MasterToolOptions
} from "./types/command-module.js";
import { CommandExecutor } from "./command-executor.js";
import { DEFAULT_MASTER_TOOL_OPTIONS } from "./types/command-module.js";
import type { ExecutionContext } from "./command-executor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class CommandRegistry {
  private executor: CommandExecutor;
  private commandsDir: string;
  private options: MasterToolOptions;
  private loadedCommandFiles: Map<string, { path: string; metadata: CommandMetadata }> = new Map();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(
    options: MasterToolOptions = {},
    private customCommands?: Map<string, CommandLoader> // Pre-registered custom commands
  ) {
    this.options = { ...DEFAULT_MASTER_TOOL_OPTIONS, ...options };
    this.executor = new CommandExecutor(this.options);
    this.commandsDir = this.options.commandsDir ?? join(__dirname, "commands");
  }

  /**
   * Initialize registry - scan commands directory
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await this.scanCommands();
        
        // Register custom commands if provided
        if (this.customCommands) {
          for (const [name, loader] of this.customCommands.entries()) {
            // Create minimal metadata for custom commands
            const metadata: CommandMetadata = {
              name,
              category: "custom",
              description: "Custom command (no metadata provided)"
            };
            this.executor.register({
              loader,
              metadata,
              schema: {},
              StateClass: undefined,
              getPersistencePath: undefined,
              lastLoaded: Date.now(),
              loadCount: 0,
              errorCount: 0
            });
          }
        }

        this.isInitialized = true;
        console.log(`[CommandRegistry] Loaded ${this.executor.listCommands().length} commands`);
      } catch (error) {
        console.error("[CommandRegistry] Failed to initialize:", error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Scan commands directory and load metadata
   */
  private async scanCommands(): Promise<void> {
    try {
      const entries = await readdir(this.commandsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Category folder (git, dev, system, etc.)
          const category = entry.name;
          const categoryDir = join(this.commandsDir, category);
          await this.scanCategory(category, categoryDir);
        } else if (entry.isFile()) {
          // Direct command file (no category)
          const ext = extname(entry.name).toLowerCase();
          if (ext === '.ts' || ext === '.js' || ext === '.mjs') {
            const commandName = basename(entry.name, ext);
            const fullPath = join(this.commandsDir, entry.name);
            await this.loadCommandMetadata(commandName, "uncategorized", fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`[CommandRegistry] Could not scan commands directory: ${String(error)}`);
    }
  }

  /**
   * Scan a category directory
   */
  private async scanCategory(category: string, categoryDir: string): Promise<void> {
    try {
      const files = await readdir(categoryDir);
      for (const file of files) {
        const fullPath = join(categoryDir, file);
        const fileStat = await stat(fullPath);
        if (!fileStat.isFile()) continue;

        const ext = extname(file).toLowerCase();
        if (ext === '.ts' || ext === '.js' || ext === '.mjs') {
          const commandName = `${category}.${basename(file, ext)}`;
          await this.loadCommandMetadata(commandName, category, fullPath);
        }
      }
    } catch (error) {
      console.warn(`[CommandRegistry] Could not scan category ${category}: ${String(error)}`);
    }
  }

  /**
   * Load command metadata WITHOUT loading the full module
   * Uses static analysis to extract metadata quickly
   */
  private createCommandMetadata(commandName: string, category: string, _filePath: string): CommandMetadata {
    return {
      name: commandName,
      category,
      description: "Loading...",
      longDescription: undefined,
      examples: [`master_tool({ command: '${commandName}', args: {} })`],
      tags: [category],
      experimental: false
    };
  }

  private createCommandLoader(filePath: string, commandName: string): CommandLoader {
    return async () => {
      const fileUrl = `file://${filePath}`;
      const module = await import(fileUrl);
      if (!module.metadata || !module.schema || !module.execute) {
        throw new Error(`Invalid command module: ${commandName}. Must export metadata, schema, execute`);
      }
      if (!module.metadata.name) module.metadata.name = commandName;
      if (!module.metadata.category) module.metadata.category = commandName.split('.')[0]; // derive from commandName
      if (!module.metadata.examples && module.metadata.description) {
        module.metadata.examples = [`master_tool({ command: '${commandName}', args: {...} })`];
      }
      return module as CommandModule;
    };
  }

  private async loadCommandMetadata(
    commandName: string,
    category: string,
    filePath: string
  ): Promise<void> {
    try {
      const metadata = this.createCommandMetadata(commandName, category, filePath);
      this.loadedCommandFiles.set(commandName, { path: filePath, metadata });
      const loader = this.createCommandLoader(filePath, commandName);
      this.executor.register({
        loader,
        metadata,
        schema: {},
        StateClass: undefined,
        getPersistencePath: undefined,
        lastLoaded: Date.now(),
        loadCount: 0,
        errorCount: 0
      });
    } catch (error) {
      console.error(`[CommandRegistry] Failed to load metadata for ${commandName}:`, error);
    }
  }

  /**
   * Ensure registry is initialized
   */
  async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Execute a command
   */
  async execute(
    commandName: string,
    args: any,
    execCtx: ExecutionContext
  ): Promise<{
    content: Array<{ type: "text"; text: string }>;
    details: any;
    isError: boolean;
  }> {
    await this.ensureInitialized();

    const result = await this.executor.execute(commandName, args, {
      toolCallId: execCtx.toolCallId,
      signal: execCtx.signal,
      onUpdate: execCtx.onUpdate,
      ctx: execCtx.ctx,
      maxOutputSize: execCtx.maxOutputSize
    });

    // Convert CommandResult to tool result format
    const isError = result.code !== 0;
    const content: Array<{ type: "text"; text: string }> = [];

    if (result.stdout) {
      content.push({ type: "text", text: result.stdout });
    }
    if (result.stderr && result.stderr.trim()) {
      content.push({ type: "text", text: result.stderr });
    }

    if (content.length === 0) {
      content.push({ type: "text", text: isError ? "Error occurred" : "Success" });
    }

    return {
      content,
      details: {
        command: commandName,
        code: result.code,
        data: result.data,
        duration: result.duration,
        ...(isError && { error: result.stderr })
      },
      isError
    };
  }

  /**
   * Get command list for UI
   */
  getCommandList(): Array<{
    name: string;
    category: string;
    description: string;
    tags: string[];
    experimental: boolean;
  }> {
    const commands: Array<{
      name: string;
      category: string;
      description: string;
      tags: string[];
      experimental: boolean;
    }> = [];

    for (const [category, names] of this.executor.listCommandsByCategory()) {
      for (const name of names) {
        const meta = this.executor.getMetadata(name);
        if (meta) {
          commands.push({
            name,
            category: category,
            description: meta.description,
            tags: meta.tags ?? [],
            experimental: meta.experimental ?? false
          });
        }
      }
    }

    return commands.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get all registered command names
   */
  listCommands(): string[] {
    return this.executor.listCommands();
  }

  /**
   * Get commands by category
   */
  listCommandsByCategory(): Map<string, string[]> {
    return this.executor.listCommandsByCategory();
  }

  /**
   * Get metadata for a command
   */
  getMetadata(commandName: string): CommandMetadata | undefined {
    return this.executor.getMetadata(commandName);
  }

  /**
   * Get command help text
   */
  getCommandHelp(commandName: string): string | null {
    const meta = this.executor.getMetadata(commandName);
    if (!meta) return null;

    const lines: string[] = [
      `Command: ${meta.name}`,
      `Category: ${meta.category}`,
      `Description: ${meta.description}`
    ];

    if (meta.longDescription) {
      lines.push(`\n${meta.longDescription}`);
    }

    if (meta.examples && meta.examples.length > 0) {
      lines.push("\nExamples:");
      meta.examples.forEach(ex => lines.push(`  ${ex}`));
    }

    if (meta.dependsOn && meta.dependsOn.length > 0) {
      lines.push(`\nDepends on: ${meta.dependsOn.join(', ')}`);
    }

    if (meta.permissions && meta.permissions.length > 0) {
      lines.push(`\nPermissions: ${meta.permissions.join(', ')}`);
    }

    if (meta.experimental) {
      lines.push("\n⚠️  EXPERIMENTAL - May change or be removed");
    }

    const schema = this.executor.getSchema(commandName);
    if (schema?.properties) {
      lines.push("\nParameters:");
      const props = schema.properties as Record<string, any>;
      const required = schema.required || [];
      for (const [key, prop] of Object.entries(props)) {
        const req = required.includes(key) ? "(required)" : "(optional)";
        const type = prop.type ?? "any";
        const desc = prop.description ?? "";
        lines.push(`  ${key}: ${type} ${req}${desc ? ` - ${desc}` : ""}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Get statistics
   */
  getStats() {
    return this.executor.getStats();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.executor.clearCache();
  }

  /**
   * Get executor for advanced operations
   */
  getExecutor(): CommandExecutor {
    return this.executor;
  }
}

/**
 * Create CommandRegistry with default options
 */
export function createCommandRegistry(
  options: MasterToolOptions = {},
  customCommands?: Map<string, CommandLoader>
): CommandRegistry {
  return new CommandRegistry(options, customCommands);
}
