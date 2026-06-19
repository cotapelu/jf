#!/usr/bin/env node
/**
 * Capability System Extension
 */

import { join, dirname } from "path";
import type { Component } from "@earendil-works/pi-tui";
import { Container, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { fileURLToPath } from "url";
import { PluginLoader, getGlobalLoader, setGlobalLoader, createPluginLoader } from "./plugin-loader.js";
import { getCapabilityRegistry } from "./registry.js";
import type { Capability } from "./types.js";
import type { CapabilityContext } from "./types.js";
import type { AgentToolResult } from "@earendil-works/pi-coding-agent";
import { createCapabilityDiscoveryCapability } from "./prompt-integration.js";

// Simple truncateToVisualLines implementation (matches pi-tui internal)
function truncateToVisualLines(text: string, maxLines: number, width: number): { visualLines: string[]; skippedCount: number } {
  const lines: string[] = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (lines.length >= maxLines) {
      skipped++;
      continue;
    }
    let pos = 0;
    while (pos < line.length) {
      if (lines.length >= maxLines) {
        skipped++;
        break;
      }
      lines.push(line.slice(pos, pos + width));
      pos += width;
    }
  }
  return { visualLines: lines, skippedCount: skipped };
}

// Simple keyHint implementation
function keyHint(action: string, fallback: string): string {
  return fallback;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
// Router Tool
// ============================================================================

function createCapabilityRouterTool(api: any) {
  interface RouterRendererState {
    startedAt?: number;
    endedAt?: number;
    interval?: NodeJS.Timeout;
  }
  const registry = getCapabilityRegistry();
  const allCaps = registry.listAll();

  // Group capabilities by plugin for clear presentation
  const byPlugin = new Map<string, Capability[]>();
  for (const cap of allCaps) {
    const pluginCaps = byPlugin.get(cap.pluginId) || [];
    pluginCaps.push(cap);
    byPlugin.set(cap.pluginId, pluginCaps);
  }

  // Helper to get capability name from ID
  const getCapabilityName = (capId: string) => {
    const cap = registry.get(capId);
    return cap?.name || capId;
  };

  // Constants for display
  const CAPABILITY_PREVIEW_LINES = 5;

  function formatDuration(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
  }

  class CapabilityResultRenderComponent extends Container {
    state: {
      cachedWidth?: number;
      cachedLines?: string[];
      cachedSkipped?: number;
    } = {};
  }

  function rebuildCapabilityRenderComponent(
    component: CapabilityResultRenderComponent,
    result: any,
    options: any,
    theme: any,
    startedAt: number | undefined,
    endedAt: number | undefined,
  ): void {
    const state = component.state;
    component.clear();

    // Extract text output
    let output = "";
    if (result.content) {
      output = result.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text || "")
        .join("\n")
        .trim();
    }

    if (output) {
      const styledOutput = output
        .split("\n")
        .map((line: string) => theme.fg("toolOutput", line))
        .join("\n");

      if (options.expanded) {
        component.addChild(new Text(`\n${styledOutput}`, 0, 0));
      } else {
        component.addChild({
          render: (width: number) => {
            if (state.cachedLines === undefined || state.cachedWidth !== width) {
              const preview = truncateToVisualLines(styledOutput, CAPABILITY_PREVIEW_LINES, width);
              state.cachedLines = preview.visualLines;
              state.cachedSkipped = preview.skippedCount;
              state.cachedWidth = width;
            }
            if (state.cachedSkipped && state.cachedSkipped > 0) {
              const hint =
                theme.fg("muted", `... (${state.cachedSkipped} earlier lines,`) +
                ` ${keyHint("app.tools.expand", "to expand")}${theme.fg("muted", ")")}`;
              return ["", truncateToWidth(hint, width, "..."), ...(state.cachedLines ?? [])];
            }
            return ["", ...(state.cachedLines ?? [])];
          },
          invalidate: () => {
            state.cachedWidth = undefined;
            state.cachedLines = undefined;
            state.cachedSkipped = undefined;
          },
        });
      }
    }

    // Timing
    if (startedAt !== undefined) {
      const label = options.isPartial ? "Elapsed" : "Took";
      const endTime = endedAt ?? Date.now();
      component.addChild(new Text(`\n${theme.fg("muted", `${label} ${formatDuration(endTime - startedAt)}`)}`, 0, 0));
    }
  };

  // Build comprehensive guidelines
  const guidelines: string[] = [
    "Execute any registered capability.",
    "First call system.capabilities() to see the full list and get current capabilities.",
    "Then call the specific capability you need.",
    "",
    "Available capabilities by plugin:"
  ];

  // List actual capabilities with IDs and short descriptions
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

  return {
    name: "capability",
    label: "Capability Router",
    description: `Execute any of ${allCaps.length} registered capabilities across ${byPlugin.size} plugins (git, dev, security, system, etc.). Discover available operations with system.capabilities().`,
    promptSnippet: "{ capability: 'system.capabilities', params: {} }",
    promptGuidelines: guidelines,
    parameters: {
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
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any): Promise<any> {
      const { capability, params: capParams } = params;
      if (!capability) {
        // @ts-ignore
        return { content: [{ type: "text" as const, text: "Missing 'capability'" }], isError: true };
      }

      const registry = getCapabilityRegistry();
      const cap = registry.get(capability);

      if (!cap) {
        const suggestions = registry.listAll()
          .filter(c => c.id.includes(capability.split('.').pop() || ''))
          .slice(0, 5).map(c => c.id);
        // @ts-ignore
        return {
          content: [{ type: "text" as const, text: `❌ Not found: ${capability}\nSuggestions: ${suggestions.join(', ')}` }],
          isError: true,
          details: { error: "not_found", capability }
        };
      }

      let startTime = 0;
      let result: any = null;
      let enhancedCtx: CapabilityContext;

      try {
        startTime = Date.now();
        // Log: capability is starting
        console.log(`[CapabilityRouter] Starting: ${cap.name} (${cap.id})`);

        enhancedCtx = {
          ...ctx,
          cwd: ctx.cwd || process.cwd(),
          exec: async (command: string, args: string[], options: { cwd?: string; env?: Record<string, string> } = {}): Promise<{ code: number; stdout: string; stderr: string }> => {
            const cwd = options.cwd || ctx.cwd || process.cwd();
            const execResult = await api.exec(command, args, { ...options, cwd, signal });
            return { code: execResult.code, stdout: execResult.stdout, stderr: execResult.stderr };
          },
          getCurrentCapability: () => cap,
          getCapability: (id: string) => registry.get(id),
          listCapabilitiesByTag: (tag: string) => registry.listAll().filter(c => c.tags.includes(tag)),
          callCapability: async (id: string, params: Record<string, any>): Promise<AgentToolResult<any>> => {
            const innerCap = registry.get(id);
            if (!innerCap) {
              throw new Error(`Capability not found: ${id}`);
            }
            const innerCtx: CapabilityContext = {
              ...ctx,
              cwd: ctx.cwd || process.cwd(),
              exec: (cmd, args, opts = {}) => {
                const cwd = opts.cwd || ctx.cwd || process.cwd();
                return api.exec(cmd, args, { ...opts, cwd, signal }) as Promise<{ code: number; stdout: string; stderr: string }>;
              },
              getCurrentCapability: () => innerCap,
              getCapability: (id2) => registry.get(id2),
              listCapabilitiesByTag: (tag) => registry.listAll().filter(c => c.tags.includes(tag)),
              callCapability: () => Promise.reject(new Error("Nested callCapability not supported"))
            };
            return innerCap.execute(toolCallId, params, signal, onUpdate, innerCtx);
          }
        };
        result = await cap.execute(toolCallId, capParams, signal, onUpdate, enhancedCtx);
        // Ensure result has capabilityId in details for renderer
        if (result && typeof result === 'object') {
          result.details = result.details || {};
          result.details.capabilityId = cap.id;
        }
        // @ts-ignore
        return result;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        result = { content: [{ type: "text" as const, text: `❌ ${msg}` }], isError: true, details: { error: msg, capabilityId: cap.id } };
        // @ts-ignore
        return result;
      } finally {
        const duration = Date.now() - startTime;
        const isError = result?.isError || (result?.content && result.content.some((c: any) => c.text?.includes('❌')));
        const emoji = isError ? "❌" : "✅";
        console.log(`[CapabilityRouter] ${emoji} ${cap.name} (${cap.id}) completed in ${duration}ms`);
        // No UI notification - use timing display instead
      }
    },

    // Display the command line when starting
    renderCall(args: any, theme: any, context: any) {
      const state = (context.state ?? {}) as RouterRendererState;
      if (context.executionStarted && state.startedAt === undefined) {
        state.startedAt = Date.now();
        state.endedAt = undefined;
      }

      const capId = args?.capability || 'unknown';
      const capName = getCapabilityName(capId);
      const params = args?.params ?? {};

      // Build human-readable command description
      // Format: $ <Capability Name> (param1: value1, param2: value2)
      let command = `$ ${capName}`;
      const paramEntries = Object.entries(params);
      if (paramEntries.length > 0) {
        const paramParts = paramEntries.map(([key, value]) => {
          // Format arrays as comma-separated
          if (Array.isArray(value)) {
            return `${key}: ${value.join(', ')}`;
          }
          // Format objects as JSON-like
          if (typeof value === 'object' && value !== null) {
            return `${key}: ${JSON.stringify(value)}`;
          }
          // Simple value
          return `${key}: ${value}`;
        });
        command += ' (' + paramParts.join(', ') + ')';
      }

      const text = theme.fg('toolTitle', theme.bold(command));
      const comp = (context.lastComponent as Text | undefined) ?? new Text('', 0, 0);
      comp.setText(text);
      return comp;
    },

    renderResult(result: any, options: any, theme: any, context: any) {
      const details = result.details || {};
      const capabilityId = details.capabilityId;

      const registry = getCapabilityRegistry();
      const cap = capabilityId ? registry.get(capabilityId) : null;

      // Use custom renderer if available
      if (cap?.renderResult) {
        try { return cap.renderResult(result, options, theme); } catch (e) {
          console.error('Capability renderer error:', e);
        }
      }

      const state = (context.state ?? {}) as RouterRendererState;

      // If running and no interval yet, start it for elapsed updates
      if (state.startedAt !== undefined && options.isPartial && !state.interval) {
        state.interval = setInterval(() => context.invalidate(), 1000);
      }

      // If finished or error, stop interval and record end time
      if (!options.isPartial || context.isError) {
        state.endedAt ??= Date.now();
        if (state.interval) {
          clearInterval(state.interval);
          state.interval = undefined;
        }
      }

      const component = (context.lastComponent as CapabilityResultRenderComponent | undefined) ?? new CapabilityResultRenderComponent();
      rebuildCapabilityRenderComponent(component, result, options, theme, state.startedAt, state.endedAt);
      component.invalidate();
      return component;
    }
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
