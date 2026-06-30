#!/usr/bin/env node
/**
 * Capability System - Public Exports
 *
 * Entry point for the capability-based plugin architecture.
 */

export { default as capabilitySystemExtension } from "./extension.js";
export { getCapabilityRegistry, resetCapabilityRegistry, createRegistry } from "./registry.js";
export { PluginLoader, createPluginLoader } from "./plugin-loader.js";
export { enhancePromptWithCapabilities, getCapabilitiesSection, generateSlashCommands, parseSlashCommand, createCapabilityDiscoveryCapability } from "./prompt-integration.js";
export * from "./types.js";
