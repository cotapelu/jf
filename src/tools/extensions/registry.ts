/**
 * Extension Framework
 * Provides modular plugin system for adding capabilities (git, docker, k8s, etc.)
 */

import type { ToolDefinition } from '@earendil-works/pi-coding-agent';

/**
 * Extension interface - all extensions must implement this
 */
export interface Extension {
  /** Unique name (e.g., 'git', 'docker', 'k8s') */
  name: string;
  /** Version string */
  version: string;
  /** Optional description */
  description?: string;
  /**
   * Register tools provided by this extension.
   * Called during runtime initialization with current working directory.
   */
  getTools(cwd: string): ToolDefinition[];
  /**
   * Optional async initialization (e.g., load config, check dependencies)
   */
  initialize?(registry: ExtensionRegistry): Promise<void> | void;
  /**
   * Optional cleanup when extension is disposed
   */
  dispose?(): Promise<void> | void;
}

/**
 * ExtensionRegistry - manages extension lifecycle and tool aggregation
 */
export class ExtensionRegistry {
  private extensions: Map<string, Extension> = new Map();
  private initialized: Set<string> = new Set();

  /**
   * Register an extension
   */
  register(extension: Extension): void {
    if (this.extensions.has(extension.name)) {
      throw new Error(`Extension "${extension.name}" is already registered`);
    }
    this.extensions.set(extension.name, extension);
  }

  /**
   * Get all tools from all registered extensions
   */
  getAllTools(cwd: string): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const ext of this.extensions.values()) {
      tools.push(...ext.getTools(cwd));
    }
    return tools;
  }

  /**
   * Get a specific extension by name
   */
  getExtension(name: string): Extension | undefined {
    return this.extensions.get(name);
  }

  /**
   * Initialize all extensions (call during startup)
   */
  async initializeAll(_cwd: string): Promise<void> {
    for (const [name, ext] of this.extensions) {
      if (ext.initialize) {
        try {
          await ext.initialize(this);
          this.initialized.add(name);
        } catch (error) {
          console.error(`[ExtensionRegistry] Failed to initialize extension "${name}":`, error);
          // Continue initializing others even if one fails
        }
      }
    }
  }

  /**
   * Dispose all extensions (call during shutdown)
   */
  async disposeAll(): Promise<void> {
    for (const [name, ext] of this.extensions) {
      if (ext.dispose) {
        try {
          await ext.dispose();
        } catch (error) {
          console.error(`[ExtensionRegistry] Failed to dispose extension "${name}":`, error);
        }
      }
    }
    this.extensions.clear();
    this.initialized.clear();
  }

  /**
   * List all registered extension names
   */
  listExtensions(): string[] {
    return Array.from(this.extensions.keys());
  }

  /**
   * Check if an extension is registered
   */
  has(name: string): boolean {
    return this.extensions.has(name);
  }

  /**
   * Get extension count
   */
  get count(): number {
    return this.extensions.size;
  }
}

/**
 * Factory: Create global registry singleton
 */
let globalRegistry: ExtensionRegistry | null = null;

export function getExtensionRegistry(): ExtensionRegistry {
  if (!globalRegistry) {
    globalRegistry = new ExtensionRegistry();
  }
  return globalRegistry;
}

export function resetExtensionRegistry(): void {
  globalRegistry = null;
}
