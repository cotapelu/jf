#!/usr/bin/env node
/**
 * Capability-Based Plugin System - Core Types
 *
 * Types and interfaces for the plugin architecture.
 */

import type { ExtensionContext, AgentToolResult, ExtensionAPI } from "@earendil-works/pi-coding-agent"; // ToolDefinition unused removed
import type { TSchema } from "typebox";

// ============================================================================
// CAPABILITY INTERFACE (unified tool interface)
// ============================================================================

/**
 * A Capability is a self-contained operation that the agent can perform.
 * It is the fundamental unit of the plugin system.
 *
 * Extends the standard ToolDefinition from PiClaw but with:
 * - Explicit `id` for namespacing (pluginId.capabilityId)
 * - Optional renderer (separate from execute)
 * - Metadata for discovery and dependency management
 */
export interface Capability {
  // Identity
  id: string;                    // Full ID: "git.status"
  name: string;                  // Human-readable: "Git Status"
  description: string;           // What it does
  pluginId: string;              // Parent plugin ID: "git"

  // LLM Interaction
  promptSnippet: string;         // Short usage example
  promptGuidelines: string[];    // Bullet points for system prompt

  // Schema
  parameters: TSchema;           // Input JSON Schema (TypeBox)
  outputSchema?: TSchema;        // Optional output schema (for validation)

  // Execution
  execute: CapabilityExecute;
  renderResult?: CapabilityRenderer;

  // Metadata
  tags: string[];                // For filtering: ["git", "vcs", "read-only"]
  dependencies: string[];        // Capability IDs this depends on
  permissions?: string[];        // Future: ["fs:read", "exec:git"]
}

/**
 * Execute function signature.
 * Similar to ToolDefinition.execute but with capability-specific context.
 */
export type CapabilityExecute = (
  toolCallId: string,
  params: Record<string, any>,
  signal: AbortSignal | null | undefined,
  onUpdate: ((data: any) => void) | null | undefined,
  ctx: CapabilityContext
) => Promise<any>;

/**
 * Render function for custom UI.
 */
export type CapabilityRenderer = (
  result: AgentToolResult<any>,
  options: any,
  theme: any
) => any; // Component

// ============================================================================
// CONTEXT
// ============================================================================

/**
 * Extended context passed to capability execution.
 * Includes all standard ExtensionContext plus capability-specific helpers.
 */
export interface CapabilityContext extends ExtensionContext {
  /** Get the current capability being executed */
  getCurrentCapability(): Capability | null;

  /** Get another capability's metadata */
  getCapability(id: string): Capability | undefined;

  /** List capabilities by tag */
  listCapabilitiesByTag(tag: string): Capability[];

  /** Shortcut: execute another capability programmatically */
  callCapability(id: string, params: Record<string, any>): Promise<AgentToolResult<any>>;

  /** Working directory for this capability execution (inherits from session) */
  cwd: string;

  /** Execute a shell command safely */
  exec(command: string, args: string[], options?: { cwd?: string; env?: Record<string, string> }): Promise<{ code: number; stdout: string; stderr: string }>;
}

// ============================================================================
// PLUGIN SYSTEM
// ============================================================================

/**
 * Manifest: Describes a plugin (collection of capabilities).
 * Loaded from manifest.json in plugin folder.
 */
export interface PluginManifest {
  id: string;                    // Unique plugin ID (e.g., "git")
  name: string;                  // Human-readable (e.g., "Git Operations")
  description: string;           // Plugin description
  version: string;               // Semantic version (e.g., "1.0.0")
  author?: string;               // Plugin author
  tags: string[];                // Plugin-level tags

  capabilities: CapabilityManifest[]; // List of capabilities

  settings?: {
    enabledByDefault: boolean;
    configSchema?: TSchema;      // Plugin configuration schema
  };
}

/**
 * Manifest for a single capability inside a plugin.
 * This is used to construct the full Capability object.
 */
export interface CapabilityManifest {
  id: string;                    // Capability ID (e.g., "status")
  name: string;                  // Human-readable (e.g., "Git Status")
  description: string;           // What this capability does
  inputSchema: TSchema;          // Parameters schema (TypeBox)
  outputSchema?: TSchema;        // Optional output validation schema

  // Paths (relative to plugin root)
  execute: string;               // Path to execute module (e.g., "capabilities/status.ts")
  renderer?: string;             // Optional: path to renderer module

  // LLM Guidance
  promptGuidelines: string[];    // Bullet points for system prompt

  // Dependencies & Permissions
  dependencies: string[];        // Other capability IDs this depends on
  permissions?: string[];        // Required permissions (future)
  requiredPlugins?: string[];    // Other plugins required
}

// ============================================================================
// REGISTRY
// ============================================================================

export interface CapabilityRegistry {
  /** Register a capability */
  register(capability: Capability): void;

  /** Get capability by full ID (pluginId.capabilityId) */
  get(id: string): Capability | undefined;

  /** Get all capabilities */
  listAll(): Capability[];

  /** Get capabilities by tag (e.g., "git", "test") */
  listByTag(tag: string): Capability[];

  /** Get capabilities by plugin ID */
  listByPlugin(pluginId: string): Capability[];

  /** Search capabilities by name/description */
  search(query: string): Capability[];

  /** Check if capability exists */
  has(id: string): boolean;

  /** Remove a capability (for hot-reload) */
  unregister(id: string): boolean;

  /** Get system prompt section (auto-generated) */
  getSystemPromptSection(options?: SystemPromptOptions): string;

  /** Get capability IDs as array (for parameter enum) */
  getCapabilityIds(): string[];
}

export interface SystemPromptOptions {
  /** Only include capabilities with these tags */
  filterTags?: string[];

  /** Exclude capabilities with these tags */
  excludeTags?: string[];

  /** Maximum number of capabilities to include (0 = unlimited) */
  maxCapabilities?: number;

  /** Sort by: 'name', 'plugin', 'none' */
  sortBy?: 'name' | 'plugin' | 'none';
}

// ============================================================================
// PLUGIN LOADER
// ============================================================================

export interface PluginLoaderOptions {
  /** Root directory for plugins (default: ./plugins) */
  pluginsDir?: string;

  /** Whether to watch for changes and hot-reload (dev mode) */
  watchMode?: boolean;

  /** Callback when plugin loaded */
  onPluginLoaded?: (manifest: PluginManifest) => void;

  /** Callback when plugin unloaded */
  onPluginUnloaded?: (pluginId: string) => void;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  capabilities: Capability[];
  reload: () => Promise<LoadedPlugin>;
  unload: () => void;
}

// ============================================================================
// FACTORY INTEGRATION
// ============================================================================

export interface CapabilityExtensionAPI extends ExtensionAPI {
  /** Get the capability registry */
  getCapabilityRegistry(): CapabilityRegistry;

  /** Register a capability directly (without plugin) */
  registerCapability(capability: Capability): void;

  /** Load plugins from directory */
  loadPlugins(dir?: string): Promise<void>;

  /** Get all registered capabilities (for debugging) */
  getAllCapabilities(): Capability[];
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Result wrapper for capability execution.
 * Mirrors AgentToolResult but standardized.
 */
export interface CapabilityResult {
  content: Array<{ type: "text" | "image"; text?: string; url?: string }>;
  details?: any;
  isError: boolean;
}

/**
 * Plugin loader statistics (for debugging/monitoring)
 */
export interface PluginLoaderStats {
  totalPlugins: number;
  totalCapabilities: number;
  loadTimeMs: number;
  errors: Array<{ pluginId: string; error: string }>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_PLUGINS_DIR = "plugins";
export const MANIFEST_FILENAME = "manifest.json";

// Registry singleton key (unused currently)
// const REGISTRY_SYMBOL = Symbol.for("pi-claw.capability.registry");
