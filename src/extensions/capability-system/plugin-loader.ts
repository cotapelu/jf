#!/usr/bin/env node
/**
 * Plugin Loader
 */

import { existsSync, readFileSync, readdirSync, watch } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import type {
  PluginManifest,
  PluginLoaderOptions,
  LoadedPlugin,
  Capability,
  PluginLoaderStats,
  CapabilityManifest,
  // CapabilityExecute removed - unused
} from "./types.js";
import type { ExtensionContext, AgentToolResult } from "@earendil-works/pi-coding-agent";
import { getCapabilityRegistry } from "./registry.js";
import { MANIFEST_FILENAME } from "./types.js";
import { generateCapabilityGuidelines, extractMinimalParams } from "./guideline-generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class PluginLoader {
  private options: Required<PluginLoaderOptions>;
  private registry = getCapabilityRegistry();
  private loadedPlugins: Map<string, LoadedPlugin> = new Map();
  private resolveCache: Map<string, { module: unknown; timestamp: number }> = new Map();
  private watchHandles: Map<string, { close: () => void }> = new Map();
  private reloadTimers: Map<string, NodeJS.Timeout> = new Map();
  private newPluginTimers: Map<string, NodeJS.Timeout> = new Map();
  private rootWatcher: { close: () => void } | null = null;
  private loadPromise: Promise<PluginLoaderStats> | null = null;
  private isLoaded = false;

  constructor(options: PluginLoaderOptions = {}) {
    this.options = {
      pluginsDir: options.pluginsDir || join(__dirname, "..", "..", "plugins"),
      watchMode: options.watchMode || false,
      onPluginLoaded: options.onPluginLoaded || (() => {}),
      onPluginUnloaded: options.onPluginUnloaded || (() => {})
    };
  }

  async loadAll(): Promise<PluginLoaderStats> {
    if (this.isLoaded) {
      return this.getStats();
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.loadPromise = this.initializeLoadPromise();
    return this.loadPromise;
  }

  private async initializeLoadPromise(): Promise<PluginLoaderStats> {
    try {
      const stats = await this.performLoadAll();
      this.isLoaded = true;
      return stats;
    } catch (error) {
      this.loadPromise = null; // Allow retry
      throw error;
    }
  }

  private async performLoadAll(): Promise<PluginLoaderStats> {
    const errors: Array<{ pluginId: string; error: string }> = [];
    const pluginsDir = resolve(this.options.pluginsDir);

    if (!existsSync(pluginsDir)) {
      return this.makeEmptyStats();
    }

    const pluginFolders = this.getPluginFolders(pluginsDir);
    await this.loadPlugins(pluginFolders, errors);

    if (this.options.watchMode) this.startWatchMode(pluginsDir);

    return this.assembleStats(errors);
  }

  private makeEmptyStats(): PluginLoaderStats {
    return { totalPlugins: 0, totalCapabilities: 0, loadTimeMs: 0, errors: [] };
  }

  private getPluginFolders(pluginsDir: string): string[] {
    return readdirSync(pluginsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  }

  private async loadPlugins(folders: string[], errors: Array<{ pluginId: string; error: string }>): Promise<void> {
    for (const folder of folders) {
      try {
        await this.loadPlugin(folder);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ pluginId: folder, error: message });
      }
    }
  }

  private assembleStats(errors: Array<{ pluginId: string; error: string }>): PluginLoaderStats {
    const totalCapabilities = Array.from(this.loadedPlugins.values()).reduce((s, p) => s + p.capabilities.length, 0);
    return {
      totalPlugins: this.loadedPlugins.size,
      totalCapabilities,
      loadTimeMs: 0,
      errors
    };
  }

  /**
   * Wait for the initial plugin load to complete.
   * Returns a promise that resolves with stats when loading finishes.
   * If already loaded, returns a resolved promise with current stats.
   */
  waitForLoad(): Promise<PluginLoaderStats> {
    if (this.isLoaded) {
      return Promise.resolve(this.getStats());
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }
    return this.loadAll();
  }

  async loadPlugin(pluginFolder: string): Promise<LoadedPlugin> {
    const pluginPath = join(this.options.pluginsDir, pluginFolder);
    const manifestPath = join(pluginPath, MANIFEST_FILENAME);

    if (!existsSync(manifestPath)) throw new Error(`Missing ${MANIFEST_FILENAME}`);

    const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    this.validateManifest(manifest, pluginFolder);

    if (this.loadedPlugins.has(manifest.id)) {
      this.unloadPlugin(manifest.id);
    }

    const capabilities = await this.loadCapabilities(pluginFolder, pluginPath, manifest);
    return this.finalizePlugin(pluginFolder, pluginPath, manifest, capabilities);
  }

  private async loadCapabilities(
    pluginFolder: string,
    pluginPath: string,
    manifest: PluginManifest
  ): Promise<Capability[]> {
    const capabilities: Capability[] = [];
    for (const capMan of manifest.capabilities) {
      try {
        const capability = await this.createCapability(pluginFolder, pluginPath, capMan, manifest);
        capabilities.push(capability);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Capability '${capMan.id}' failed: ${message}`);
      }
    }
    return capabilities;
  }

  private finalizePlugin(
    pluginFolder: string,
    pluginPath: string,
    manifest: PluginManifest,
    capabilities: Capability[]
  ): LoadedPlugin {
    const loaded = this.createLoadedPlugin(pluginFolder, manifest, capabilities);
    this.loadedPlugins.set(manifest.id, loaded);
    for (const cap of capabilities) {
      this.registry.register(cap);
    }
    this.options.onPluginLoaded(manifest);
    if (this.options.watchMode) {
      this.watchSinglePlugin(pluginPath, pluginFolder);
    }
    return loaded;
  }

  private createLoadedPlugin(
    pluginFolder: string,
    manifest: PluginManifest,
    capabilities: Capability[]
  ): LoadedPlugin {
    return {
      manifest,
      capabilities,
      reload: async () => {
        this.unloadPlugin(manifest.id);
        return this.loadPlugin(pluginFolder);
      },
      unload: () => this.unloadPlugin(manifest.id)
    };
  }

  private async createCapability(
    pluginId: string,
    pluginPath: string,
    capMan: CapabilityManifest,
    pluginMan: PluginManifest
  ): Promise<Capability> {
    const executePath = join(pluginPath, capMan.execute);
    const rendererPath = capMan.renderer ? join(pluginPath, capMan.renderer) : null;

    const { executeFn } = await this.loadExecuteModule(executePath);
    const renderResultFn = rendererPath ? await this.loadRendererModule(rendererPath) : undefined;

    const { capabilityId, finalGuidelines, promptSnippet } = this.computeCapabilityMetadata(pluginMan, capMan);

    return this.buildCapability(
      pluginId,
      capMan,
      pluginMan,
      executeFn,
      renderResultFn,
      capabilityId,
      finalGuidelines,
      promptSnippet
    );
  }

  private computeCapabilityMetadata(
    pluginMan: PluginManifest,
    capMan: CapabilityManifest
  ): { capabilityId: string; finalGuidelines: string[]; promptSnippet: string } {
    const capabilityId = `${pluginMan.id}.${capMan.id}`;
    const finalGuidelines = generateCapabilityGuidelines(
      capabilityId,
      capMan.inputSchema,
      capMan.outputSchema,
      capMan.promptGuidelines || []
    );
    const minimalParams = extractMinimalParams(capMan.inputSchema);
    const promptSnippet = JSON.stringify({
      capability: capabilityId,
      params: minimalParams
    }, null, 2);
    return { capabilityId, finalGuidelines, promptSnippet };
  }

  private async loadExecuteModule(executePath: string): Promise<{executeFn: (params: Record<string, unknown>, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>}> {
    const executeModule = await this.dynamicImport(executePath);
    // @ts-ignore - dynamic module shape
    const rawExecuteFn = executeModule.execute || executeModule.default;
    if (typeof rawExecuteFn !== "function") throw new Error("Missing execute function");
    const executeFn = rawExecuteFn as (params: Record<string, unknown>, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>;
    return { executeFn };
  }

  private async loadRendererModule(rendererPath: string): Promise<Capability["renderResult"] | undefined> {
    if (!existsSync(rendererPath)) return undefined;
    try {
      const rendererModule = await this.dynamicImport(rendererPath);
      // @ts-ignore - dynamic module shape
      return rendererModule.renderResult || rendererModule.default;
    } catch {
      return undefined;
    }
  }

  private buildCapability(
    pluginId: string,
    capMan: CapabilityManifest,
    pluginMan: PluginManifest,
    executeFn: (params: Record<string, unknown>, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>,
    renderResultFn: Capability["renderResult"] | undefined,
    capabilityId: string,
    finalGuidelines: string[],
    promptSnippet: string
  ): Capability {
    return {
      id: capabilityId,
      name: capMan.name,
      description: capMan.description,
      pluginId,
      promptSnippet,
      promptGuidelines: finalGuidelines,
      parameters: capMan.inputSchema,
      outputSchema: capMan.outputSchema,
      execute: this.createExecuteHandler(capabilityId, executeFn),
      ...(renderResultFn && { renderResult: renderResultFn }),
      tags: pluginMan.tags,
      dependencies: capMan.dependencies,
      permissions: capMan.permissions
    };
  }

  private createExecuteHandler(
    capabilityId: string,
    executeFn: (params: Record<string, unknown>, ctx: ExtensionContext) => Promise<AgentToolResult<unknown>>
  ): Capability["execute"] {
    return async (
      toolCallId: string,
      params: Record<string, unknown>,
      signal: AbortSignal | null | undefined,
      onUpdate: ((data: unknown) => void) | null | undefined,
      ctx: ExtensionContext
    ): Promise<AgentToolResult<unknown>> => {
      try {
        const result = await executeFn(params, ctx);
        return {
          ...result,
          details: result.details && typeof result.details === 'object' && !Array.isArray(result.details)
            ? { ...result.details, capabilityId }
            : { capabilityId }
        };
      } catch (error: unknown) {
        return {
          content: [{ type: "text" as const, text: `❌ ${capabilityId} error: ${error instanceof Error ? error.message : String(error)}` }],
          details: { error: error instanceof Error ? error.message : String(error), capabilityId },
          isError: true
        };
      }
    };
  }

  private async dynamicImport(filePath: string): Promise<unknown> {
    const fileUrl = `file://${filePath}`;
    await this.clearModuleCache(fileUrl);
    const module = await import(fileUrl);
    this.resolveCache.set(fileUrl, { module, timestamp: Date.now() });
    return module;
  }

  private async clearModuleCache(fileUrl: string): Promise<void> {
    if (this.resolveCache.has(fileUrl)) {
      this.resolveCache.delete(fileUrl);
    }
    try {
      const mod = await import('module');
      // @ts-ignore - accessing internal ESM cache
      const esmCache = mod._cache;
      if (esmCache && esmCache[fileUrl]) {
        delete esmCache[fileUrl];
      }
    } catch {
      // Ignore if internal cache not accessible
    }
  }

  private startWatchMode(pluginsDir: string): void {
    // Root watcher to detect new plugin folders and deletions
    this.rootWatcher = watch(pluginsDir, { recursive: false }, (event: string, filename: string | null) => {
      if (!filename) return;
      if (event !== 'rename') return;

      const pluginPath = join(pluginsDir, filename);
      const pluginExists = existsSync(pluginPath);
      if (pluginExists) {
        // New plugin folder created - schedule load with debounce to wait for manifest
        this.scheduleNewPluginLoad(filename);
      } else {
        // Plugin folder was deleted
        this.unloadPlugin(filename);
      }
    });
  }

  private scheduleNewPluginLoad(pluginFolder: string): void {
    // Clear any pending load for this plugin
    const existing = this.newPluginTimers.get(pluginFolder);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.newPluginTimers.delete(pluginFolder);
      const pluginPath = join(this.options.pluginsDir, pluginFolder);
      const manifestPath = join(pluginPath, MANIFEST_FILENAME);

      // Only load if manifest exists now
      if (existsSync(manifestPath)) {
        this.loadPlugin(pluginFolder).catch(err => {
          console.error(`[PluginLoader] Delayed load failed for ${pluginFolder}:`, err);
        });
      } else {
        console.warn(`[PluginLoader] Manifest not found for ${pluginFolder} after delay, skipping`);
      }
    }, 500); // 500ms debounce allows file system operations to complete

    this.newPluginTimers.set(pluginFolder, timer);
  }

  private watchSinglePlugin(pluginPath: string, pluginFolder: string): void {
    const watcher = watch(pluginPath, { recursive: true }, (event: string, filename: string | null) => {
      if (!filename) return;
      if (filename.includes('node_modules') || filename.includes('.git')) return;

      // Clear module cache for this plugin before reload to ensure fresh imports
      this.resolveCache.clear();
      // Debounce reload to avoid flooding on rapid changes
      this.scheduleReload(pluginFolder);
    });

    this.watchHandles.set(pluginFolder, { close: () => watcher.close() });
  }

  private validateCapability(cap: any): void {
    if (!cap.id || !cap.execute) throw new Error("Capability missing id/execute");
    if (!/^[a-z][a-z0-9_-]*$/.test(cap.id)) throw new Error(`Invalid capability ID: ${cap.id}`);
  }

  private validateManifest(manifest: PluginManifest, _pluginFolder: string): void {
    if (!manifest.id) throw new Error("Missing 'id'");
    if (!manifest.name) throw new Error("Missing 'name'");
    if (!manifest.description) throw new Error("Missing 'description'");
    if (!manifest.version) throw new Error("Missing 'version'");
    if (!manifest.capabilities) throw new Error("Missing 'capabilities'");
    if (!/^[a-z][a-z0-9_-]*$/.test(manifest.id)) throw new Error(`Invalid plugin ID: ${manifest.id}`);
    if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) throw new Error("At least one capability required");
    for (const cap of manifest.capabilities) {
      this.validateCapability(cap);
    }
  }

  private clearAllTimers(): void {
    for (const timer of this.reloadTimers.values()) clearTimeout(timer);
    this.reloadTimers.clear();
    for (const timer of this.newPluginTimers.values()) clearTimeout(timer);
    this.newPluginTimers.clear();
  }

  private unloadAllPlugins(): void {
    const pluginIds = Array.from(this.loadedPlugins.keys());
    for (const pluginId of pluginIds) {
      this.unloadPlugin(pluginId);
    }
  }

  private closeAllWatchers(): void {
    this.resolveCache.clear();
    for (const handle of this.watchHandles.values()) handle.close();
    this.watchHandles.clear();
    this.rootWatcher?.close();
  }

  unloadAll(): void {
    this.clearAllTimers();
    this.unloadAllPlugins();
    this.closeAllWatchers();
  }

  getStats(): PluginLoaderStats {
    const totalCapabilities = Array.from(this.loadedPlugins.values()).reduce((sum, p) => sum + p.capabilities.length, 0);
    return { totalPlugins: this.loadedPlugins.size, totalCapabilities, loadTimeMs: 0, errors: [] };
  }

  getLoadedPlugins(): LoadedPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  private scheduleReload(pluginId: string): void {
    // Clear any pending reload
    const existing = this.reloadTimers.get(pluginId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.reloadTimers.delete(pluginId);
      if (this.loadedPlugins.has(pluginId)) {
        this.loadPlugin(pluginId).catch(err => console.error(`[PluginLoader] Reload failed for ${pluginId}:`, err));
      }
    }, 200); // 200ms debounce

    this.reloadTimers.set(pluginId, timer);
  }

  private clearReloadTimer(pluginId: string): void {
    const timer = this.reloadTimers.get(pluginId);
    if (timer) {
      clearTimeout(timer);
      this.reloadTimers.delete(pluginId);
    }
  }

  private closeWatcher(pluginId: string): void {
    const handle = this.watchHandles.get(pluginId);
    if (handle) {
      handle.close();
      this.watchHandles.delete(pluginId);
    }
  }

  private unloadPlugin(pluginId: string): void {
    this.clearReloadTimer(pluginId);
    this.closeWatcher(pluginId);
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) return;
    for (const cap of plugin.capabilities) {
      this.registry.unregister(cap.id);
    }
    this.loadedPlugins.delete(pluginId);
    this.options.onPluginUnloaded(pluginId);
  }
}

export function createPluginLoader(options?: PluginLoaderOptions): PluginLoader {
  return new PluginLoader(options);
}

let globalLoader: PluginLoader | null = null;
export function setGlobalLoader(loader: PluginLoader): void { globalLoader = loader; }
export function getGlobalLoader(): PluginLoader | null { return globalLoader; }

/**
 * Helper for tests: wait until the capability system has finished loading plugins.
 * Throws if the system was not initialized (extensionsAggregator not yet run).
 */
export async function waitForInitialization(): Promise<void> {
  const loader = getGlobalLoader();
  if (!loader) {
    throw new Error("Capability system not initialized. Ensure the capabilitySystemExtension has been called.");
  }
  await loader.waitForLoad();
}

export default PluginLoader;
