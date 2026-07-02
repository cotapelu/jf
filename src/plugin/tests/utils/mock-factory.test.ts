#!/usr/bin/env node
/**
 * Mock Factory Utils Tests
 */

import { describe, it, expect } from 'vitest';
import { createMockExtensionAPI, createMockContext } from './mock-factory';

describe('Mock Factory Utils', () => {
  describe('createMockExtensionAPI', () => {
    it('returns an API object with required methods', () => {
      const api = createMockExtensionAPI();
      expect(typeof api.on).toBe('function');
      expect(typeof api.registerTool).toBe('function');
      expect(typeof api.registerCommand).toBe('function');
      expect(typeof api.getContext).toBe('function');
      expect(api.tui).toBeDefined();
      expect(typeof api.tui.addChild).toBe('function');
    });

    it('records registerCommand calls', () => {
      const api = createMockExtensionAPI();
      const handler = () => {};
      api.registerCommand('cmd', { description: 'desc', handler });
      expect(api.registerCommand).toHaveBeenCalledWith('cmd', expect.objectContaining({
        description: 'desc',
        handler,
      }));
    });

    it('records on calls', () => {
      const api = createMockExtensionAPI();
      const cb = () => {};
      api.on('event', cb);
      expect(api.on).toHaveBeenCalledWith('event', cb);
    });

    it('getContext returns a mock context', () => {
      const api = createMockExtensionAPI();
      const ctx = api.getContext();
      expect(ctx).toBeDefined();
      expect(ctx.cwd).toBeDefined();
    });
  });

  describe('createMockContext', () => {
    it('returns default cwd', () => {
      const ctx = createMockContext();
      expect(ctx.cwd).toBe(process.cwd());
    });

    it('accepts custom overrides', () => {
      const ctx = createMockContext({ cwd: '/custom' });
      expect(ctx.cwd).toBe('/custom');
    });

    it('includes ui with setWidget and theme', () => {
      const ctx = createMockContext();
      expect(ctx.ui).toBeDefined();
      expect(typeof ctx.ui.setWidget).toBe('function');
      expect(ctx.ui.theme).toBeDefined();
      expect(typeof ctx.ui.theme.fg).toBe('function');
      expect(typeof ctx.ui.theme.bold).toBe('function');
    });

    it('includes registerCommand', () => {
      const ctx = createMockContext();
      expect(typeof ctx.registerCommand).toBe('function');
    });
  });
});
