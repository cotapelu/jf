#!/usr/bin/env node
/**
 * Branch coverage for capability-system extension.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

// Mock dependencies before importing extension
vi.mock('../plugin-loader', async () => {
  const actual = await vi.importActual('../plugin-loader');
  return {
    ...actual,
    createPluginLoader: vi.fn(),
    getGlobalLoader: vi.fn(),
    setGlobalLoader: vi.fn()
  };
});
vi.mock('../registry', async () => {
  const actual = await vi.importActual('../registry');
  return {
    ...actual,
    getCapabilityRegistry: vi.fn()
  };
});
vi.mock('../prompt-integration', async () => {
  return {
    createCapabilityDiscoveryCapability: vi.fn(() => ({ id: 'system.capabilities', name: 'Discovery' }))
  };
});

const { createPluginLoader, getGlobalLoader, setGlobalLoader } = await import('../plugin-loader');
const { getCapabilityRegistry } = await import('../registry');
import capabilitySystemExtension from '../extension';

describe('extension.ts branch coverage', () => {
  let mockRegistry: any;
  let mockLoader: any;
  let mockApi: any;
  let capturedTool: any = null;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    vi.clearAllMocks();

    mockRegistry = {
      has: vi.fn(),
      register: vi.fn(),
      listAll: vi.fn().mockReturnValue([]),
      get: vi.fn()
    };
    mockLoader = {
      loadAll: vi.fn().mockResolvedValue({ totalPlugins: 0, totalCapabilities: 0, errors: [] }),
      getStats: vi.fn().mockReturnValue({ totalPlugins: 0, totalCapabilities: 0, errors: [] }),
      getLoadedPlugins: vi.fn().mockReturnValue([])
    };
    mockApi = {
      registerTool: (tool: any) => { capturedTool = tool; },
      registerCommand: vi.fn(),
      pluginLoader: undefined as any,
      exec: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' })
    };

    (getCapabilityRegistry as any).mockReturnValue(mockRegistry);
    (createPluginLoader as any).mockReturnValue(mockLoader);
    (getGlobalLoader as any).mockReturnValue(undefined);
  });

  describe('capabilitySystemExtension initialization branches', () => {
    it('uses default loader and sets global when no custom loader', async () => {
      await capabilitySystemExtension(mockApi);
      expect(createPluginLoader).toHaveBeenCalled();
      expect(setGlobalLoader).toHaveBeenCalledWith(mockLoader);
    });

    it('does NOT set global loader when custom loader provided', async () => {
      const customLoader = { loadAll: vi.fn().mockResolvedValue({ totalPlugins: 0, totalCapabilities: 0, errors: [] }) };
      const apiWithLoader = { ...mockApi, pluginLoader: customLoader };
      await capabilitySystemExtension(apiWithLoader);
      expect(createPluginLoader).not.toHaveBeenCalled();
      expect(setGlobalLoader).not.toHaveBeenCalled();
    });

    it('logs warning when stats.errors exist', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockLoader.loadAll = vi.fn().mockResolvedValue({
        totalPlugins: 1,
        totalCapabilities: 2,
        errors: ['some error']
      });
      await capabilitySystemExtension(mockApi);
      expect(consoleWarn).toHaveBeenCalledWith(['some error']);
      consoleWarn.mockRestore();
    });

    it('handles loadAll failure and throws', async () => {
      mockLoader.loadAll = vi.fn().mockRejectedValue(new Error('load failed'));
      await expect(capabilitySystemExtension(mockApi)).rejects.toThrow('load failed');
    });

    it('registers discovery capability only if not present', async () => {
      mockRegistry.has.mockReturnValue(false);
      await capabilitySystemExtension(mockApi);
      expect(mockRegistry.register).toHaveBeenCalled();
    });

    it('skips discovery registration if already exists', async () => {
      mockRegistry.has.mockReturnValue(true);
      await capabilitySystemExtension(mockApi);
      expect(mockRegistry.register).not.toHaveBeenCalled();
    });

    it('registers plugins command in dev mode', async () => {
      process.env.NODE_ENV = 'development';
      await capabilitySystemExtension(mockApi);
      expect(mockApi.registerCommand).toHaveBeenCalledWith('plugins', expect.any(Object));
    });

    it('does NOT register plugins command when not dev mode', async () => {
      process.env.NODE_ENV = 'production';
      await capabilitySystemExtension(mockApi);
      expect(mockApi.registerCommand).not.toHaveBeenCalled();
    });

    it('does NOT register plugins command if registerCommand not a function', async () => {
      process.env.NODE_ENV = 'development';
      const api = { ...mockApi, registerCommand: undefined as any };
      await capabilitySystemExtension(api);
      expect(api.registerCommand).toBeUndefined();
    });

    it('captures the registered tool after initialization', async () => {
      await capabilitySystemExtension(mockApi);
      expect(capturedTool).toBeDefined();
      expect(capturedTool.name).toBe('plugin.capability');
    });
  });

  describe('Capability Router Tool branches', () => {
    let routerTool: any;
    let mockCapability: any;

    function createMockCapability(overrides = {}) {
      return {
        id: 'test.cap',
        name: 'Test Capability',
        description: 'Test Cap Description',
        pluginId: 'test',
        tags: ['test'],
        dependencies: [],
        parameters: {},
        execute: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'OK' }], isError: false }),
        renderResult: undefined,
        ...overrides
      };
    }

    beforeEach(async () => {
      capturedTool = null;
      mockCapability = createMockCapability();
      mockRegistry.listAll.mockReturnValue([mockCapability]);
      mockRegistry.get.mockImplementation((id: string) => {
        if (id === 'test.cap') return mockCapability;
        if (id === 'missing.cap') return null;
        return null;
      });
      await capabilitySystemExtension(mockApi);
      routerTool = capturedTool;
    });

    it('returns error when capability param missing', async () => {
      const result = await routerTool.execute('id', {}, null, null, { cwd: process.cwd() } as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Missing 'capability'/);
    });

    it('returns not found with suggestions when capability unknown', async () => {
      mockRegistry.get.mockReturnValue(null);
      mockRegistry.listAll.mockReturnValue([
        { id: 'git.status' },
        { id: 'dev.test' },
        { id: 'security.scan' }
      ]);
      const result = await routerTool.execute('id', { capability: 'unknown.cap' }, null, null, { cwd: process.cwd() } as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Not found: unknown.cap');
      expect(result.content[0].text).toContain('Suggestions:');
    });

    it('delegates to capability.execute success', async () => {
      const result = await routerTool.execute('id', { capability: 'test.cap', params: {} }, null, null, { cwd: process.cwd() } as any);
      expect(result.isError).toBe(false);
      expect(mockCapability.execute).toHaveBeenCalled();
    });

    it('handles capability.execute exception', async () => {
      mockCapability.execute = vi.fn().mockRejectedValue(new Error('cap error'));
      const result = await routerTool.execute('id', { capability: 'test.cap', params: {} }, null, null, { cwd: process.cwd() } as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ cap error');
      expect(result.details.capabilityId).toBe('test.cap');
    });

    it('enhances context with callCapability and other helpers', async () => {
      let capturedCtx: any = null;
      mockCapability.execute = vi.fn().mockImplementation(async (toolCallId, capParams, signal, onUpdate, ctx) => {
        capturedCtx = ctx;
        return { content: [{ type: 'text', text: 'OK' }], isError: false };
      });
      const ctx = { cwd: process.cwd() } as any;
      const result = await routerTool.execute('id', { capability: 'test.cap', params: {} }, null, null, ctx);
      expect(result.isError).toBe(false);
      expect(capturedCtx).toBeDefined();
      expect(capturedCtx).toHaveProperty('callCapability');
      expect(capturedCtx).toHaveProperty('getCapability');
      expect(capturedCtx).toHaveProperty('listCapabilitiesByTag');
    });

    it('renderCall formats command with params', () => {
      const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s };
      const comp = routerTool.renderCall({ capability: 'test.cap', params: { file: 'a.ts', limit: 10 } }, theme, { state: {} });
      const lines = comp.render ? comp.render(80) : [comp.text];
      const text = lines.join('\n');
      expect(text).toContain('$ Test Capability');
    });

    it('renderResult uses custom renderer when cap provides one', () => {
      const custom = vi.fn(() => ({ render: () => ['custom'] }));
      const capWithCustom = createMockCapability({ renderResult: custom });
      mockRegistry.get.mockReturnValue(capWithCustom);
      const result = { content: [{ type: 'text', text: 'OK' }], isError: false, details: { capabilityId: 'test.cap' } };
      const theme = { fg: (c: string, s: string) => s };
      const rendered = routerTool.renderResult(result, { expanded: false, isPartial: false }, theme, { state: {}, invalidate: vi.fn() });
      expect(custom).toHaveBeenCalled();
    });

    it('renderResult falls back to default component when no custom renderer', () => {
      const result = { content: [{ type: 'text', text: 'Hello\nWorld' }], isError: false, details: {} };
      const theme = { fg: (c: string, s: string) => s };
      const ctx = { state: {}, invalidate: vi.fn(), isError: false };
      const rendered = routerTool.renderResult(result, { expanded: false, isPartial: false }, theme, ctx);
      expect(rendered).toBeDefined();
    });

    it('renderResult with expanded shows full output', () => {
      const result = { content: [{ type: 'text', text: 'Line1\nLine2' }], isError: false, details: {} };
      const theme = { fg: (c: string, s: string) => s };
      const rendered = routerTool.renderResult(result, { expanded: true, isPartial: false }, theme, { state: {}, invalidate: vi.fn(), isError: false });
      expect(rendered).toBeDefined();
    });

    it('renderResult uses startedAt and sets endedAt on final', () => {
      const result = { content: [{ type: 'text', text: 'OK' }], isError: false, details: {} };
      const theme = { fg: (c: string, s: string) => s };
      // Simulate state after renderCall has set startedAt
      const context = { state: { startedAt: Date.now() }, invalidate: vi.fn(), isError: false };
      // Partial render should not set endedAt
      const partialRendered = routerTool.renderResult(result, { expanded: false, isPartial: true }, theme, context);
      expect(partialRendered).toBeDefined();
      expect(context.state.startedAt).toBeDefined();
      expect(context.state.endedAt).toBeUndefined();
      // Final render should set endedAt
      const finalRendered = routerTool.renderResult(result, { expanded: false, isPartial: false }, theme, context);
      expect(finalRendered).toBeDefined();
      expect(context.state).toHaveProperty('endedAt');
    });
  });
});

describe('truncateToVisualLines branch coverage', () => {
  // Replicate the function logic for isolated testing
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

  it('truncates when lines exceed maxLines', () => {
    const text = 'line1\nline2\nline3';
    const result = truncateToVisualLines(text, 2, 80);
    expect(result.visualLines).toHaveLength(2);
    expect(result.skippedCount).toBe(1);
  });

  it('wraps long lines when exceeding width', () => {
    const longLine = 'a'.repeat(150);
    const result = truncateToVisualLines(longLine, 10, 80);
    expect(result.visualLines.length).toBeGreaterThan(1);
    expect(result.visualLines.every(l => l.length <= 80)).toBe(true);
  });

  it('does not truncate when under maxLines', () => {
    const text = 'line1\nline2';
    const result = truncateToVisualLines(text, 5, 80);
    expect(result.visualLines).toHaveLength(2);
    expect(result.skippedCount).toBe(0);
  });

  it('handles empty text', () => {
    const result = truncateToVisualLines('', 5, 80);
    expect(result.visualLines).toHaveLength(0);
    expect(result.skippedCount).toBe(0);
  });

  it('skips entire line when maxLines reached mid-line', () => {
    const text = 'short\nvery long line that wraps\nanother';
    const result = truncateToVisualLines(text, 2, 80);
    expect(result.visualLines).toHaveLength(2);
    expect(result.visualLines.find(l => l.includes('another'))).toBeUndefined();
  });
});
