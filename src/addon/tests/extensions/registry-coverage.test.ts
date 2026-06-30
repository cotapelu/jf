import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtensionRegistry, Extension, getExtensionRegistry, resetExtensionRegistry } from '../../tools/extensions/registry.js';

describe('ExtensionRegistry - Coverage Gaps', () => {
  let registry: ExtensionRegistry;

  beforeEach(() => {
    registry = new ExtensionRegistry();
  });

  describe('initializeAll with extension without initialize', () => {
    it('should not throw and should skip extension lacking initialize', async () => {
      const extNoInit: Extension = {
        name: 'no-init',
        version: '1.0.0',
        getTools: () => []
        // no initialize
      };
      const extWithInit = {
        name: 'with-init',
        version: '1.0.0',
        getTools: () => [],
        initialize: vi.fn().mockResolvedValue(undefined)
      } as Extension;
      registry.register(extNoInit);
      registry.register(extWithInit);
      await expect(registry.initializeAll('/cwd')).resolves.not.toThrow();
      expect(extWithInit.initialize).toHaveBeenCalled();
    });
  });

  describe('disposeAll with extension without dispose', () => {
    it('should not throw and should dispose extensions that have dispose', async () => {
      const extNoDispose: Extension = {
        name: 'no-dispose',
        version: '1.0.0',
        getTools: () => []
        // no dispose
      };
      const extWithDispose = {
        name: 'with-dispose',
        version: '1.0.0',
        getTools: () => [],
        dispose: vi.fn().mockResolvedValue(undefined)
      } as Extension;
      registry.register(extNoDispose);
      registry.register(extWithDispose);
      await expect(registry.disposeAll()).resolves.not.toThrow();
      expect(extWithDispose.dispose).toHaveBeenCalled();
      expect(registry.count).toBe(0);
    });
  });

  describe('disposeAll when dispose throws', () => {
    it('should catch error and continue disposing others, then clear extensions', async () => {
      const extBad = {
        name: 'bad',
        version: '1.0.0',
        getTools: () => [],
        dispose: vi.fn().mockRejectedValue(new Error('dispose failed'))
      } as Extension;
      const extGood = {
        name: 'good',
        version: '1.0.0',
        getTools: () => [],
        dispose: vi.fn().mockResolvedValue(undefined)
      } as Extension;
      registry.register(extBad);
      registry.register(extGood);
      await expect(registry.disposeAll()).resolves.not.toThrow();
      expect(extBad.dispose).toHaveBeenCalled();
      expect(extGood.dispose).toHaveBeenCalled();
      expect(registry.count).toBe(0);
    });
  });
});

describe('ExtensionRegistry singleton behavior', () => {
  beforeEach(() => {
    resetExtensionRegistry();
  });

  it('should return same instance on subsequent calls', async () => {
    const { getExtensionRegistry } = await import('../../tools/extensions/registry.js');
    const instance1 = getExtensionRegistry();
    const instance2 = getExtensionRegistry();
    expect(instance1).toBe(instance2);
  });

  it('should create new instance after reset', async () => {
    const { getExtensionRegistry, resetExtensionRegistry } = await import('../../tools/extensions/registry.js');
    const instance1 = getExtensionRegistry();
    resetExtensionRegistry();
    const instance2 = getExtensionRegistry();
    expect(instance1).not.toBe(instance2);
  });
});
