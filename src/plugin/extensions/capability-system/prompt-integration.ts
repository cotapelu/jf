#!/usr/bin/env node
/**
 * System Prompt Integration
 */

import { getCapabilityRegistry } from "./registry.js";
import type { SystemPromptOptions, Capability } from "./types.js";
import { Type } from "typebox";

/**
 * Enhances base prompt with capabilities section.
 */
export function enhancePromptWithCapabilities(
  basePrompt: string,
  options: SystemPromptOptions = {}
): string {
  const registry = getCapabilityRegistry();
  const capabilitiesSection = registry.getSystemPromptSection(options);

  if (!capabilitiesSection) {
    return basePrompt;
  }

  const guidelinesIndex = basePrompt.indexOf("\n\n## Guidelines");
  const notesIndex = basePrompt.indexOf("\n\n## Notes");

  if (guidelinesIndex !== -1) {
    return `${basePrompt.slice(0, guidelinesIndex)  }\n\n${  capabilitiesSection  }${basePrompt.slice(guidelinesIndex)}`;
  }
  if (notesIndex !== -1) {
    return `${basePrompt.slice(0, notesIndex)  }\n\n${  capabilitiesSection  }${basePrompt.slice(notesIndex)}`;
  }
  return `${basePrompt  }\n\n${  capabilitiesSection}`;
}

/**
 * Get just the capabilities section (for debugging).
 */
export function getCapabilitiesSection(options?: SystemPromptOptions): string {
  const registry = getCapabilityRegistry();
  return registry.getSystemPromptSection(options);
}

// ============================================================================
// SLASH COMMANDS
// ============================================================================

export function generateSlashCommands(sortBy: 'plugin' | 'name' = 'plugin'): Array<{ command: string; description: string; capabilityId: string }> {
  const registry = getCapabilityRegistry();
  const capabilities = registry.listAll();

  const sorted = [...capabilities].sort((a, b) => {
    if (sortBy === 'plugin') {
      const pluginCmp = a.pluginId.localeCompare(b.pluginId);
      if (pluginCmp !== 0) return pluginCmp;
      const aShort = a.id.split('.').pop() || a.id;
      const bShort = b.id.split('.').pop() || b.id;
      return aShort.localeCompare(bShort);
    }
    return a.name.localeCompare(b.name);
  });

  return sorted.map(cap => ({
    command: `/${cap.id.replace(/\./g, '.')}`,
    description: cap.description,
    capabilityId: cap.id
  }));
}

export function parseSlashCommand(input: string): string | null {
  if (!input.startsWith('/')) return null;
  const cmd = input.slice(1).trim();
  if (!cmd) return null;
  const capabilityId = cmd.replace(/\s/g, '.');
  const registry = getCapabilityRegistry();
  return registry.has(capabilityId) ? capabilityId : null;
}

// ============================================================================
// CAPABILITY DISCOVERY
// ============================================================================

export function createCapabilityDiscoveryCapability(): Capability {
  return {
    id: "system.capabilities",
    name: "List Capabilities",
    description: "List all available capabilities, optionally filtered by tags.",
    pluginId: "system",
    promptSnippet: "{ capability: 'system.capabilities', params: { tag?: 'git' } }",
    promptGuidelines: [
      "Use this to discover what operations are available.",
      "Optional filter by tag: system.capabilities({ tag: 'git' })",
      "Returns list of capability IDs, names, and descriptions."
    ],
    parameters: Type.Object({
      tag: Type.Optional(Type.String({ description: "Filter by tag (e.g., 'git', 'test', 'analyze')" }))
    }),
    execute: async (toolCallId: string, params: Record<string, any>, signal: AbortSignal | null | undefined, onUpdate: any, ctx: any) => {
      const registry = getCapabilityRegistry();
      const filterTag = params.tag as string | undefined;
      const capabilities = filterTag
        ? registry.listByTag(filterTag)
        : registry.listAll();

      const list = capabilities.map(cap => ({
        id: cap.id,
        name: cap.name,
        description: cap.description,
        tags: cap.tags,
        guidelines: cap.promptGuidelines.slice(0, 2)
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
        details: { count: list.length, filter: filterTag },
        isError: false
      };
    },
    tags: ["system", "meta"],
    dependencies: []
  };
}

// Default export
export default enhancePromptWithCapabilities;
