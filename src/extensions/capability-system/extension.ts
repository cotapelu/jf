#!/usr/bin/env node
/**
 * Capability System Extension
 */

import { join, dirname } from "path";
import type { Component } from "@earendil-works/pi-tui";
import { Text } from "@earendil-works/pi-tui";
import { fileURLToPath } from "url";
import { PluginLoader, getGlobalLoader, setGlobalLoader, createPluginLoader } from "./plugin-loader.js";
import { getCapabilityRegistry } from "./registry.js";
import type { Capability } from "./types.js";
import type { CapabilityContext } from "./types.js";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import { createCapabilityDiscoveryCapability } from "./prompt-integration.js";
import { CapabilityResultRenderComponent, rebuildCapabilityRenderComponent } from "./capability-renderer.js";

// Helper for reducing execute complexity (Cycle 117)
function populateResultDetails(result: any, cap: any): void {
  if (result && typeof result === 'object') {
    result.details = result.details || {};
    result.details.capabilityId = cap.id;
  }
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper functions for complexity reduction (Cycle 117)
function createExecFunction(api: any, ctx: any, signal: any): CapabilityContext['exec'] {
  return async (command: string, args: string[], options: { cwd?: string; env?: Record<string, string> } = {}): Promise<{ code: number; stdout: string; stderr: string }> => {
    const cwd = options.cwd || ctx.cwd || process.cwd();
    const execResult = await api.exec(command, args, { ...options, cwd, signal });
    return { code: execResult.code, stdout: execResult.stdout, stderr: execResult.stderr };
  };
}

function createCallCapabilityFunction(registry: any, api: any, toolCallId: string, ctx: any, signal: any, onUpdate: any): CapabilityContext['callCapability'] {
  return async (id: string, params: Record<string, any>): Promise<any> => {
    const innerCap = registry.get(id);
    if (!innerCap) {
      throw new Error(`Capability not found: ${id}`);
    }
    const innerCtx: CapabilityContext = {
      ...ctx,
      cwd: ctx.cwd || process.cwd(),
      exec: createExecFunction(api, ctx, signal),
      getCurrentCapability: () => innerCap,
      getCapability: (id2: string) => registry.get(id2),
      listCapabilitiesByTag: (tag: string) => registry.listAll().filter((c: Capability) => c.tags.includes(tag)),
      callCapability: () => Promise.reject(new Error("Nested callCapability not supported"))
    };
    return innerCap.execute(toolCallId, params, signal, onUpdate, innerCtx);
  };
}

function buildEnhancedContext(ctx: any, api: any, registry: any, cap: any, signal: any, toolCallId: string, onUpdate: any): CapabilityContext {
  return {
    ...ctx,
    cwd: ctx.cwd || process.cwd(),
    exec: createExecFunction(api, ctx, signal),
    getCurrentCapability: () => cap,
    getCapability: (id: string) => registry.get(id),
    listCapabilitiesByTag: (tag: string) => registry.listAll().filter((c: Capability) => c.tags.includes(tag)),
    callCapability: createCallCapabilityFunction(registry, api, toolCallId, ctx, signal, onUpdate)
  };
}

// Rendering helpers
function maybeStartInterval(state: any, options: any, context: any): void {
  if (state.startedAt !== undefined && options.isPartial && !state.interval) {
    state.interval = setInterval(() => context.invalidate(), 1000);
  }
}
function maybeStopInterval(state: any, options: any, context: any): void {
  if (!options.isPartial || context.isError) {
    state.endedAt ??= Date.now();
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = undefined;
    }
  }
}

/**
 * Extension factory.
 */
export default async function capabilitySystemExtension(api: any): Promise<any> {
  console.log("[CapabilitySystem] Initializing...");

  const registry = getCapabilityRegistry();

  // Allow injection of custom loader (for scoped/test usage)
  const customLoader = api?.pluginLoader as PluginLoader | undefined;
  const loader = customLoader || createPluginLoader({
    pluginsDir: getPluginsPath(),
    watchMode: isDevMode(),
    onPluginLoaded: (m) => console.log(`[CapabilitySystem] Loaded plugin: ${m.name}`),
    onPluginUnloaded: (id) => console.log(`[CapabilitySystem] Unloaded: ${id}`)
  });

  // Set global loader only if using default (production) loader
  if (!customLoader) {
    setGlobalLoader(loader);
  }

  // Store reference for this extension instance (for watch mode cleanup if needed)

  try {
    const stats = await loader.loadAll();
    console.log(`[CapabilitySystem] ${stats.totalPlugins} plugins, ${stats.totalCapabilities} capabilities`);
    if (stats.errors.length) console.warn(stats.errors);
  } catch (err) {
    console.error("[CapabilitySystem] Plugin loading failed:", err);
    throw err;
  }

  const discoveryId = 'system.capabilities';
  if (!registry.has(discoveryId)) {
    registry.register(createCapabilityDiscoveryCapability());
  } else {
    console.log('[CapabilitySystem] Discovery capability already registered, skipping');
  }
  api.registerTool(createCapabilityRouterTool(api));

  if (isDevMode() && typeof api.registerCommand === 'function') {
    api.registerCommand('plugins', {
      description: 'List loaded plugins (debug)',
      handler: async (args: string, ctx: any) => {
        const loader = getGlobalLoader();
        if (!loader) { ctx.ui?.notify?.("Not initialized", "error"); return; }

        const stats = loader.getStats();
        const plugins = loader.getLoadedPlugins();
        let out = `📦 Capability System\n${"=".repeat(30)}\n\nPlugins: ${stats.totalPlugins}\nCapabilities: ${stats.totalCapabilities}\n\n`;

        for (const p of plugins) {
          out += `📦 ${p.manifest.name} (${p.manifest.id})\n`;
          for (const c of p.capabilities) {
            out += `  • ${c.name} (${c.id})\n`;
          }
          out += "\n";
        }

        ctx.ui.custom((tui: any, theme: any, kb: any, done: any) => {
          const comp = new Text(out);
          // @ts-ignore
          comp.handleInput = (data: string) => {
            if (data === 'escape' || data === 'ctrl+c') done(undefined);
          };
          return comp as Component;
        });
      }
    });
  }
  // Return empty object to satisfy extension discovery
  return {};
}

// ============================================================================
// Capability Router Helpers (Batch 38)
// ============================================================================

interface RouterRendererState {
  startedAt?: number;
  endedAt?: number;
  interval?: NodeJS.Timeout;
}

function groupCapsByPlugin(registry: any): Map<string, Capability[]> {
  const allCaps = registry.listAll();
  const byPlugin = new Map<string, Capability[]>();
  for (const cap of allCaps) {
    const pluginCaps = byPlugin.get(cap.pluginId) || [];
    pluginCaps.push(cap);
    byPlugin.set(cap.pluginId, pluginCaps);
  }
  return byPlugin;
}

function getCapabilityName(registry: any, capId: string): string {
  const cap = registry.get(capId);
  return cap?.name || capId;
}

function buildCapabilityGuidelines(byPlugin: Map<string, Capability[]>): string[] {
  const guidelines: string[] = [
    "Execute any registered capability.",
    "First call system.capabilities() to see the full list and get current capabilities.",
    "Then call the specific capability you need.",
    "",
    "Available capabilities by plugin:"
  ];

  const sortedPluginIds = Array.from(byPlugin.keys()).sort();
  for (const pluginId of sortedPluginIds) {
    const caps = byPlugin.get(pluginId)!;
    guidelines.push(`\n**${pluginId}** (${caps.length}):`);
    for (const cap of caps) {
      guidelines.push(`- ${cap.id}: ${cap.description}`);
    }
  }

  guidelines.push("");
  guidelines.push("Format: { capability: 'plugin.capability', params: { ... } }");
  guidelines.push("Example: { capability: 'system.capabilities', params: { tag: 'git' } }");

  return guidelines;
}

function buildCapabilityDescription(allCaps: Capability[], byPlugin: Map<string, Capability[]>): string {
  return `Execute any of ${allCaps.length} registered capabilities across ${byPlugin.size} plugins (git, dev, security, system, etc.). Discover available operations with system.capabilities().`;
}

function capabilityParameters(): any {
  return {
    type: "object",
    properties: {
      capability: {
        type: "string",
        description: "Capability ID (e.g., 'git.status', 'dev.test', 'security.scan', 'system.metrics')"
      },
      params: {
        type: "object",
        description: "Arguments for the capability (see each capability's schema)"
      }
    },
    required: ["capability", "params"]
  };
}

function findCapabilityWithSuggestions(registry: any, capabilityId: string): { cap?: Capability; suggestions?: string[]; found: boolean } {
  const cap = registry.get(capabilityId);
  if (cap) return { cap, found: true };
  const suggestions = registry.listAll()
    .filter((c: any) => c.id.includes(capabilityId.split('.').pop() || ''))
    .slice(0, 5).map((c: any) => c.id);
  return { suggestions, found: false };
}

function formatCapabilityCommand(args: any, getName: (id: string) => string): string {
  const capId = args?.capability || 'unknown';
  const capName = getName(capId);
  const params = args?.params ?? {};

  let command = `$ ${capName}`;
  const paramEntries = Object.entries(params);
  if (paramEntries.length > 0) {
    const paramParts = paramEntries.map(([key, value]) => {
      if (Array.isArray(value)) return `${key}: ${value.join(', ')}`;
      if (typeof value === 'object' && value !== null) return `${key}: ${JSON.stringify(value)}`;
      return `${key}: ${String(value)}`;
    });
    command += ' (' + paramParts.join(', ') + ')';
  }
  return command;
}

function handleExecuteError(error: unknown, cap: Capability): any {
  const msg = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: `❌ ${msg}` }], isError: true, details: { error: msg, capabilityId: cap.id } };
}

function logCompletion(cap: Capability, duration: number, result: any): void {
  const isError = result?.isError || (result?.content && result.content.some((c: any) => c.text?.includes('❌')));
  const emoji = isError ? "❌" : "✅";
  console.log(`[CapabilityRouter] ${emoji} ${cap.name} (${cap.id}) completed in ${duration}ms`);
}

function createExecuteFunction(api: any, registry: any): ToolDefinition['execute'] {
  return async (toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any): Promise<any> => {
    const { capability, params: capParams } = params;
    if (!capability) {
      return { content: [{ type: "text" as const, text: "Missing 'capability'" }], isError: true };
    }

    const lookup = findCapabilityWithSuggestions(registry, capability);
    if (!lookup.cap) {
      return {
        content: [{ type: "text" as const, text: `❌ Not found: ${capability}\nSuggestions: ${lookup.suggestions?.join(', ') || 'none'}` }],
        isError: true,
        details: { error: "not_found", capability }
      };
    }

    const cap = lookup.cap;
    const startTime = Date.now();
    let result: any;
    try {
      const enhancedCtx = buildEnhancedContext(ctx, api, registry, cap, signal, toolCallId, onUpdate);
      result = await cap.execute(toolCallId, capParams, signal, onUpdate, enhancedCtx);
      populateResultDetails(result, cap);
    } catch (error) {
      result = handleExecuteError(error, cap);
    } finally {
      const duration = Date.now() - startTime;
      logCompletion(cap, duration, result);
    }
    return result;
  };
}

function createRenderCallFunction(registry: any): ToolDefinition['renderCall'] {
  return (args: any, theme: any, context: any) => {
    const state = (context.state ?? {}) as RouterRendererState;
    if (context.executionStarted && state.startedAt === undefined) {
      state.startedAt = Date.now();
      state.endedAt = undefined;
    }

    const command = formatCapabilityCommand(args, (id: string) => getCapabilityName(registry, id));
    const text = theme.fg('toolTitle', theme.bold(command));
    const comp = (context.lastComponent as Text | undefined) ?? new Text('', 0, 0);
    comp.setText(text);
    return comp;
  };
}

function createRenderResultFunction(registry: any): ToolDefinition['renderResult'] {
  return (result: any, options: any, theme: any, context: any) => {
    const details = result.details || {};
    const capabilityId = details.capabilityId;
    const cap = capabilityId ? registry.get(capabilityId) : null;

    if (cap?.renderResult) {
      try { return cap.renderResult(result, options, theme); } catch (e) {
        console.error('Capability renderer error:', e);
      }
    }

    const state = (context.state ?? {}) as RouterRendererState;
    maybeStartInterval(state, options, context);
    maybeStopInterval(state, options, context);

    const component = (context.lastComponent as CapabilityResultRenderComponent | undefined) ?? new CapabilityResultRenderComponent();
    rebuildCapabilityRenderComponent(component, result, options, theme, state.startedAt, state.endedAt);
    component.invalidate();
    return component;
  };
}

// ============================================================================
// Router Tool
// ============================================================================

function createCapabilityRouterTool(api: any): ToolDefinition {
  const registry = getCapabilityRegistry();
  const allCaps = registry.listAll();
  const byPlugin = groupCapsByPlugin(registry);

  return {
    name: "capability",
    label: "Capability Router",
    description: buildCapabilityDescription(allCaps, byPlugin),
    promptSnippet: "{ capability: 'system.capabilities', params: {} }",
    promptGuidelines: buildCapabilityGuidelines(byPlugin),
    parameters: capabilityParameters(),
    execute: createExecuteFunction(api, registry),
    renderCall: createRenderCallFunction(registry),
    renderResult: createRenderResultFunction(registry)
  };
}

// ============================================================================
// Helpers
// ============================================================================

function getPluginsPath(): string {
  const env = process.env.PICLAW_PLUGINS_DIR;
  if (env) return env;
  // Default: plugins/ folder alongside this extension
  return join(__dirname, "plugins");
}

function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.PICLAW_DEV === '1';
}
