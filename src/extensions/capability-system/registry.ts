#!/usr/bin/env node
/**
 * Capability Registry - Singleton
 *
 * Central registry for all capabilities.
 * Provides registration, lookup, search, and system prompt generation.
 */

import type { Capability, CapabilityRegistry } from "./types.js";
// Type import removed - unused

class RegistryImpl implements CapabilityRegistry {
  private capabilities: Map<string, Capability> = new Map();
  private pluginCapabilities: Map<string, Set<string>> = new Map(); // pluginId -> Set<capabilityId>

  // ============================================================================
  // REGISTRATION
  // ============================================================================

  register(capability: Capability): void {
    if (this.capabilities.has(capability.id)) {
      throw new Error(`Capability '${capability.id}' is already registered`);
    }

    this.capabilities.set(capability.id, capability);

    // Track plugin -> capabilities
    let pluginCaps = this.pluginCapabilities.get(capability.pluginId);
    if (!pluginCaps) {
      pluginCaps = new Set();
      this.pluginCapabilities.set(capability.pluginId, pluginCaps);
    }
    pluginCaps.add(capability.id);
  }

  unregister(id: string): boolean {
    const cap = this.capabilities.get(id);
    if (!cap) return false;

    this.capabilities.delete(id);

    const pluginCaps = this.pluginCapabilities.get(cap.pluginId);
    if (pluginCaps) {
      pluginCaps.delete(id);
      if (pluginCaps.size === 0) {
        this.pluginCapabilities.delete(cap.pluginId);
      }
    }

    return true;
  }

  // ============================================================================
  // LOOKUP
  // ============================================================================

  get(id: string): Capability | undefined {
    return this.capabilities.get(id);
  }

  has(id: string): boolean {
    return this.capabilities.has(id);
  }

  listAll(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  listByPlugin(pluginId: string): Capability[] {
    const pluginCaps = this.pluginCapabilities.get(pluginId);
    if (!pluginCaps) return [];

    return Array.from(pluginCaps)
      .map(id => this.capabilities.get(id))
      .filter((cap): cap is Capability => cap !== undefined);
  }

  listByTag(tag: string): Capability[] {
    return this.listAll().filter(cap => cap.tags.includes(tag));
  }

  search(query: string): Capability[] {
    const lowerQuery = query.toLowerCase();
    return this.listAll().filter(cap =>
      cap.name.toLowerCase().includes(lowerQuery) ||
      cap.description.toLowerCase().includes(lowerQuery) ||
      cap.id.toLowerCase().includes(lowerQuery) ||
      cap.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getCapabilityIds(): string[] {
    return Array.from(this.capabilities.keys());
  }

  // ============================================================================
  // SYSTEM PROMPT GENERATION
  // ============================================================================

  getSystemPromptSection(options: CapabilityRegistry["getSystemPromptSection"] extends (...args: any) => any ? Parameters<CapabilityRegistry["getSystemPromptSection"]>[0] : any = {}): string {
    const capabilities = this.applyFilter(this.listAll(), options);

    if (capabilities.length === 0) {
      return "";
    }

    const lines: string[] = [
      "## Available Capabilities",
      "",
      "You have access to the following capabilities (tools):",
      ""
    ];

    for (const cap of capabilities) {
      lines.push(`### ${cap.name}`);
      lines.push(`ID: \`${cap.id}\``);
      lines.push(cap.description);
      lines.push("");

      if (cap.promptGuidelines && cap.promptGuidelines.length > 0) {
        lines.push("**Guidelines:**");
        for (const guideline of cap.promptGuidelines) {
          lines.push(`- ${guideline}`);
        }
        lines.push("");
      }

      // Show parameters inline (simplified)
      const paramSummary = this.summarizeParameters(cap.parameters);
      if (paramSummary) {
        lines.push(`**Parameters:** \`${paramSummary}\``);
        lines.push("");
      }

      lines.push("---");
      lines.push("");
    }

    return lines.join('\n');
  }

  private applyFilter(capabilities: Capability[], options: any): Capability[] {
    let result = capabilities;

    // Filter by tags
    if (options.filterTags && options.filterTags.length > 0) {
      result = result.filter(cap =>
        options.filterTags.some((tag: string) => cap.tags.includes(tag))
      );
    }

    // Exclude by tags
    if (options.excludeTags && options.excludeTags.length > 0) {
      result = result.filter(cap =>
        !options.excludeTags.some((tag: string) => cap.tags.includes(tag))
      );
    }

    // Sort
    if (options.sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (options.sortBy === 'plugin') {
      result.sort((a, b) => a.pluginId.localeCompare(b.pluginId) || a.name.localeCompare(b.name));
    }

    // Limit
    if (options.maxCapabilities && options.maxCapabilities > 0) {
      result = result.slice(0, options.maxCapabilities);
    }

    return result;
  }

  private summarizeParameters(schema: any): string {
    // Extract top-level properties for quick summary
    if (!schema || !schema.properties) {
      return "{}";
    }

    const props = schema.properties as Record<string, any>;
    const summaries: string[] = [];

    for (const [key, prop] of Object.entries(props)) {
      const type = prop.type || 'any';
      const required = schema.required?.includes(key);
      summaries.push(`${key}: ${type}${required ? '*' : ''}`);
    }

    return `{ ${summaries.join(', ')} }`;
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  getStats(): { total: number; byPlugin: Record<string, number>; byTag: Record<string, number> } {
    const caps = this.listAll();
    const byPlugin: Record<string, number> = {};
    const byTag: Record<string, number> = {};

    for (const cap of caps) {
      byPlugin[cap.pluginId] = (byPlugin[cap.pluginId] || 0) + 1;
      for (const tag of cap.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }

    return {
      total: caps.length,
      byPlugin,
      byTag
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let globalRegistry: RegistryImpl | null = null;

/**
 * Get or create the global capability registry.
 */
export function getCapabilityRegistry(): CapabilityRegistry {
  if (!globalRegistry) {
    globalRegistry = new RegistryImpl();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (for testing).
 */
export function resetCapabilityRegistry(): void {
  globalRegistry = null;
}

/**
 * Create a new isolated registry instance (for testing).
 */
export function createRegistry(): CapabilityRegistry {
  return new RegistryImpl();
}

// Default export for convenience
export default getCapabilityRegistry();
