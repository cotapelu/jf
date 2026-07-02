#!/usr/bin/env node
/**
 * Capability System Extension - Comprehensive Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../plugin-loader', () => ({
  createPluginLoader: vi.fn(),
  getGlobalLoader: vi.fn(),
  setGlobalLoader: vi.fn()
}));
vi.mock('../registry', () => ({
  getCapabilityRegistry: vi.fn()
}));
vi.mock('../prompt-integration', () => ({
  createCapabilityDiscoveryCapability: vi.fn()
}));

// Import mocked functions
import { createPluginLoader, getGlobalLoader, setGlobalLoader } from '../plugin-loader';
import { getCapabilityRegistry } from '../registry';
import { createCapabilityDiscoveryCapability } from '../prompt-integration';
import capabilitySystemExtension from '../extension';

// Cast mocks to any for easy configuration
const mockCreatePluginLoader = createPluginLoader as any;
const mockGetGlobalLoader = getGlobalLoader as any;
const mockSetGlobalLoader = setGlobalLoader as any;
const mockGetCapabilityRegistry = getCapabilityRegistry as any;
const mockCreateCapabilityDiscoveryCapability = createCapabilityDiscoveryCapability as any;

function createMockRegistry(overrides = {}) {
  return {
    has: vi.fn(),
    register: vi.fn(),
    listAll: vi.fn().mockReturnValue([]),
    get: vi.fn(),
    execute: vi.fn(),
    ...overrides
  };
}

function createMockLoader(stats = { totalPlugins: 0, totalCapabilities: 0, errors: [] }) {
  return {
    loadAll: vi.fn().mockResolvedValue(stats),
    getStats: vi.fn().mockReturnValue(stats),
    getLoadedPlugins: vi.fn().mockReturnValue([])
  };
}

function createMockApi() {
  return {
    registerTool: vi.fn(),
    registerCommand: vi.fn()
  };
}

describe('capabilitySystemExtension', () => {
  let mockRegistry: any;
  let mockLoader: any;
  let mockApi: any;

  beforeEach(() => {
    // Reset env
    delete process.env.NODE_ENV;
    delete process.env.PICLAW_DEV;

    // Clear mocks
    vi.clearAllMocks();

    // Fresh mocks
    mockRegistry = createMockRegistry();
    mockLoader = createMockLoader();

    // Configure module mocks
    mockGetCapabilityRegistry.mockReturnValue(mockRegistry);
    mockCreatePluginLoader.mockReturnValue(mockLoader);
    mockGetGlobalLoader.mockReturnValue(undefined);
    mockCreateCapabilityDiscoveryCapability.mockReturnValue({ name: 'Discovery', id: 'system.capabilities' });

    mockApi = createMockApi();
  });

  describe('loader initialization', () => {
    it('uses default loader when no custom loader provided', async () => {
      await capabilitySystemExtension(mockApi);
      expect(mockCreatePluginLoader).toHaveBeenCalled();
      expect(mockSetGlobalLoader).toHaveBeenCalledWith(mockLoader);
    });

    it('does NOT set global loader when custom loader provided', async () => {
      const customLoader = createMockLoader();
      const customApi = { ...mockApi, pluginLoader: customLoader };
      await capabilitySystemExtension(customApi);
      expect(mockCreatePluginLoader).not.toHaveBeenCalled();
      expect(mockSetGlobalLoader).not.toHaveBeenCalled();
    });

    it('calls loader.loadAll and logs stats', async () => {
      const stats = { totalPlugins: 2, totalCapabilities: 5, errors: [] };
      mockLoader.loadAll = vi.fn().mockResolvedValue(stats);
      console.log = vi.fn(); // suppress output
      await capabilitySystemExtension(mockApi);
      expect(mockLoader.loadAll).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('[CapabilitySystem] 2 plugins, 5 capabilities');
    });

    it('logs warning if loadAll includes errors', async () => {
      const stats = { totalPlugins: 1, totalCapabilities: 3, errors: ['some error'] };
      mockLoader.loadAll = vi.fn().mockResolvedValue(stats);
      console.warn = vi.fn();
      await capabilitySystemExtension(mockApi);
      expect(console.warn).toHaveBeenCalledWith(['some error']);
    });

    it('handles loadAll failure and throws', async () => {
      mockLoader.loadAll = vi.fn().mockRejectedValue(new Error('load failed'));
      console.error = vi.fn();
      await expect(capabilitySystemExtension(mockApi)).rejects.toThrow('load failed');
      expect(console.error).toHaveBeenCalledWith('[CapabilitySystem] Plugin loading failed:', expect.any(Error));
    });
  });

  describe('discovery capability registration', () => {
    it('registers discovery capability if not present', async () => {
      mockRegistry.has.mockReturnValue(false);
      await capabilitySystemExtension(mockApi);
      expect(mockRegistry.has).toHaveBeenCalledWith('system.capabilities');
      expect(mockRegistry.register).toHaveBeenCalledWith({ name: 'Discovery', id: 'system.capabilities' });
    });

    it('skips registration if discovery capability already exists', async () => {
      mockRegistry.has.mockReturnValue(true);
      await capabilitySystemExtension(mockApi);
      expect(mockRegistry.register).not.toHaveBeenCalled();
    });
  });

  describe('capability router tool registration', () => {
    it('registers router tool with api', async () => {
      await capabilitySystemExtension(mockApi);
      expect(mockApi.registerTool).toHaveBeenCalled();
      const tool = mockApi.registerTool.mock.calls[0][0];
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('execute');
      expect(tool).toHaveProperty('renderCall');
      expect(tool).toHaveProperty('renderResult');
    });
  });

  describe('dev mode plugins command', () => {
    it('registers plugins command when in dev mode and registerCommand exists', async () => {
      process.env.NODE_ENV = 'development';
      const apiWithCommand = { ...mockApi, registerCommand: vi.fn() };
      await capabilitySystemExtension(apiWithCommand);
      expect(apiWithCommand.registerCommand).toHaveBeenCalledWith(
        'plugins',
        expect.objectContaining({
          description: 'List loaded plugins (debug)',
          handler: expect.any(Function)
        })
      );
    });

    it('does NOT register plugins command when not dev mode', async () => {
      process.env.NODE_ENV = 'production';
      const apiWithCommand = { ...mockApi, registerCommand: vi.fn() };
      await capabilitySystemExtension(apiWithCommand);
      expect(apiWithCommand.registerCommand).not.toHaveBeenCalled();
    });

    it('does NOT register plugins command if registerCommand not a function', async () => {
      process.env.NODE_ENV = 'development';
      const apiWithNonFunction = { ...mockApi, registerCommand: 'not a function' as any };
      // Should not throw
      await capabilitySystemExtension(apiWithNonFunction);
    });

    describe('plugins command handler', () => {
      let handler: any;
      beforeEach(async () => {
        process.env.NODE_ENV = 'development';
        mockApi.registerCommand = vi.fn((name: string, def: any) => {
          if (name === 'plugins') handler = def.handler;
        });
        await capabilitySystemExtension(mockApi);
      });

      it('shows error if loader not initialized', async () => {
        const ctx = { ui: { notify: vi.fn() } };
        await handler('', ctx);
        expect(ctx.ui.notify).toHaveBeenCalledWith('Not initialized', 'error');
      });

      it('lists plugins when loader available', async () => {
        const fakePlugins = [{ manifest: { name: 'Test', id: 'test' }, capabilities: [] }];
        mockGetGlobalLoader.mockReturnValue({
          getStats: () => ({ totalPlugins: 1, totalCapabilities: 0 }),
          getLoadedPlugins: () => fakePlugins
        });
        const ctx = { ui: { custom: vi.fn() } } as any;
        await handler('', ctx);
        expect(ctx.ui.custom).toHaveBeenCalled();
      });
    });
  });

  describe('router tool behavior', () => {
    let tool: any;

    beforeEach(async () => {
      await capabilitySystemExtension(mockApi);
      tool = mockApi.registerTool.mock.calls[0][0];
    });

    describe('execute', () => {
      const mockCtx = {} as any;

      it('returns error if capability missing in params', async () => {
        const result = await tool.execute('id', { args: {} } as any, undefined, undefined, mockCtx);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Missing 'capability'");
      });

      it('returns error if capability not found', async () => {
        mockRegistry.get.mockReturnValue(undefined);
        const result = await tool.execute('id', { capability: 'unknown.cmd', params: {} } as any, undefined, undefined, mockCtx);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Not found');
        expect(result.details?.error).toBe('not_found');
      });

      it('delegates to capability.execute when found', async () => {
        const mockCapExecute = vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'cap result' }],
          details: { capabilityId: 'test.cmd' },
          isError: false
        });
        mockRegistry.get.mockReturnValue({ execute: mockCapExecute });
        const result = await tool.execute('id', { capability: 'test.cmd', params: {} } as any, undefined, undefined, mockCtx);
        expect(result.content[0].text).toBe('cap result');
        expect(mockCapExecute).toHaveBeenCalled();
      });

      it('forwards signal to capability.execute', async () => {
        const mockCapExecute = vi.fn().mockResolvedValue({ content: [], details: {}, isError: false });
        mockRegistry.get.mockReturnValue({ execute: mockCapExecute });
        const signal = new AbortController().signal;
        await tool.execute('id', { capability: 'test.cmd', params: {} } as any, signal, undefined, mockCtx);
        const callArgs = mockCapExecute.mock.calls[0];
        expect(callArgs[2]).toBe(signal); // third argument is signal
      });

      it('handles exceptions from capability.execute', async () => {
        mockRegistry.get.mockReturnValue({ execute: vi.fn().mockRejectedValue(new Error('cap error')) });
        const result = await tool.execute('id', { capability: 'test.cmd', params: {} } as any, undefined, undefined, mockCtx);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('❌ cap error');
        expect(result.details?.error).toBe('cap error');
      });
    });

    describe('renderCall', () => {
      it('renders command line with capability and params', () => {
        const theme = { fg: (c: string, t: string) => t, bold: (t: string) => t };
        const result = tool.renderCall({ capability: 'git.status', params: { verbose: true } }, theme, {} as any);
        // Router tool renderCall displays command as `$ git.status (verbose: true)`
        expect(result.text).toContain('git.status');
        expect(result.text).toContain('verbose: true');
      });
    });

    describe('renderResult', () => {
      const theme = { fg: (c: string, t: string) => t, bold: (t: string) => t };

      it('handles partial state without crashing', () => {
        const result = tool.renderResult(
          { content: [], details: { command: 'test' }, isError: false },
          { expanded: false, isPartial: true },
          theme,
          {} as any
        );
        expect(result).toBeDefined();
      });

      it('handles error state', () => {
        const result = tool.renderResult(
          { content: [], details: { command: 'test', error: 'boom' }, isError: true },
          { expanded: false, isPartial: false },
          theme,
          {} as any
        );
        expect(result).toBeDefined();
      });

      it('handles success with exit code and duration', () => {
        const result = tool.renderResult(
          { content: [{ type: 'text', text: 'Output' }], details: { command: 'dev.test', code: 0, duration: 1234 }, isError: false },
          { expanded: false, isPartial: false },
          theme,
          {} as any
        );
        expect(result).toBeDefined();
      });

      it('handles long output truncation (not expanded)', () => {
        const long = Array(20).fill('line').join('\n');
        const result = tool.renderResult(
          { content: [{ type: 'text', text: long }], details: { command: 'test', code: 0 }, isError: false },
          { expanded: false, isPartial: false },
          theme,
          {} as any
        );
        expect(result).toBeDefined();
      });

      it('handles expanded output without truncation', () => {
        const lines = Array(20).fill('line').join('\n');
        const result = tool.renderResult(
          { content: [{ type: 'text', text: lines }], details: { command: 'test', code: 0 }, isError: false },
          { expanded: true, isPartial: false },
          theme,
          {} as any
        );
        expect(result).toBeDefined();
      });

      it('falls back to stdout when no details', () => {
        const result = tool.renderResult(
          { content: [{ type: 'text', text: 'Plain' }], details: {}, isError: false },
          { expanded: false, isPartial: false },
          theme,
          {} as any
        );
        expect(result).toBeDefined();
      });
    });
  });
});
