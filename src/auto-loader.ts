#!/usr/bin/env node
/**
 * AutoLoader - Zero-config loader for extensions & plugins
 *
 * Call loadAll() once in main.ts to automatically discover and load:
 * - All extensions from src/extensions/ (via extensionsAggregator)
 * - All plugins from src/plugins/ (via capability system)
 *
 * Extensions are registered to the global ExtensionRegistry.
 * Plugins are registered to the global CapabilityRegistry.
 */

import extensionsAggregator from './extensions/index.js';
import { getExtensionRegistry } from './tools/extensions/registry.js';
import { getGlobalLoader, createPluginLoader } from './extensions/capability-system/plugin-loader.js';
import { exec as childProcessExec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';

const execAsync = promisify(childProcessExec);

let loaded = false;

/**
 * Auto-load all extensions and plugins.
 * This is the only function you need to call in main.ts.
 *
 * @returns Promise<void> - resolves when everything is loaded
 */
export async function loadAll(): Promise<void> {
  if (loaded) return;

  console.log('[AutoLoader] Starting auto-load...');

  // 1. Load extensions from src/extensions/
  await loadExtensions();

  // 2. Load plugins from src/plugins/ (if capability system was initialized by extensions)
  await loadPlugins();

  loaded = true;
  console.log('[AutoLoader] Auto-load complete');
}

/**
 * Load extensions via extensionsAggregator and register tools
 */
async function loadExtensions(): Promise<void> {
  const collectedTools: ToolDefinition[] = [];

  const api = {
    registerTool: (tool: ToolDefinition) => {
      collectedTools.push(tool);
    },
    registerCommand: (_name: string, _def: any) => {
      // Commands handled by Pi SDK's service registry
    },
    exec: async (command: string, args: string[], options?: { cwd?: string; env?: Record<string, string> }) => {
      const cwd = options?.cwd ?? process.cwd();
      try {
        const cmd = command + (args.length ? ' ' + args.join(' ') : '');
        const result = await execAsync(cmd, { cwd, env: options?.env, maxBuffer: 1024 * 1024 * 10 });
        return { code: 0, stdout: result.stdout, stderr: result.stderr };
      } catch (err: any) {
        return { code: err.code || 1, stdout: '', stderr: err.stderr || String(err) };
      }
    },
    log: (...args: any[]) => console.log('[Extension]', ...args),
    ui: undefined,
    notify: (msg: string, type?: string) => {
      console[type === 'error' ? 'error' : 'log']('[Notification]', msg);
    }
  };

  try {
    await (extensionsAggregator as any)(api);
    console.log(`[AutoLoader] Extensions: ${collectedTools.length} tools collected`);

    // Register all collected tools as a single "aggregate" extension
    const registry = getExtensionRegistry();
    const aggregateExt = {
      name: 'auto-loaded-extensions',
      version: '1.0.0',
      description: 'All tools from src/extensions/',
      getTools: (_cwd: string) => collectedTools,
      initialize: async () => { /* already loaded */ },
      dispose: async () => { /* cleanup if needed */ }
    };
    registry.register(aggregateExt); // type assertion OK (structural)

  } catch (err: any) {
    console.error('[AutoLoader] Failed to load extensions:', err);
    throw err;
  }
}

/**
 * Load plugins from src/plugins/ using capability system
 */
async function loadPlugins(): Promise<void> {
  const existingLoader = getGlobalLoader();
  if (existingLoader) {
    console.log('[AutoLoader] Plugin loader already initialized by capability system');
    return;
  }

  const pluginsDir = join(__dirname, 'plugins');
  try {
    const loader = createPluginLoader({
      pluginsDir,
      watchMode: process.env.NODE_ENV === 'development' || process.env.PICLAW_DEV === '1',
      onPluginLoaded: (m) => console.log(`[AutoLoader] Plugin: ${m.name}`),
      onPluginUnloaded: (id) => console.log(`[AutoLoader] Unloaded: ${id}`)
    });
    const stats = await loader.loadAll();
    console.log(`[AutoLoader] Plugins: ${stats.totalPlugins} plugins, ${stats.totalCapabilities} capabilities`);
  } catch (err: any) {
    // No plugins folder - that's fine
    if (!err.message.includes('Cannot find module') && !err.message.includes('ENOENT')) {
      console.error('[AutoLoader] Plugin loading error:', err);
    }
  }
}

import { join } from 'path';
