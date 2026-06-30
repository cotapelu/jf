import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExtensionRegistry, Extension } from '../../tools/extensions/registry.js';

class MockExtension implements Extension {
  name: string;
  version = '1.0.0';
  description?: string;
  public initCalled = false;
  public disposeCalled = false;

  constructor(public tools: any[], name: string = 'mock') {
    this.name = name;
  }

  getTools(cwd: string): any[] {
    return this.tools;
  }

  initialize(registry: any): void {
    this.initCalled = true;
  }

  dispose(): void {
    this.disposeCalled = true;
  }
}

describe('ExtensionRegistry', () => {
  let registry: ExtensionRegistry;

  beforeEach(() => {
    registry = new ExtensionRegistry();
  });

  describe('register', () => {
    it('should register an extension', () => {
      const ext = new MockExtension([{ name: 'mock.tool' }]);
      registry.register(ext);
      expect(registry.has('mock')).toBe(true);
      expect(registry.listExtensions()).toContain('mock');
    });

    it('should throw on duplicate registration', () => {
      const ext1 = new MockExtension([]);
      const ext2 = new MockExtension([]);
      registry.register(ext1);
      expect(() => registry.register(ext2)).toThrow('already registered');
    });
  });

  describe('getAllTools', () => {
    it('should aggregate tools from all extensions', () => {
      registry.register(new MockExtension([{ name: 'tool1' }], 'ext1'));
      registry.register(new MockExtension([{ name: 'tool2' }, { name: 'tool3' }], 'ext2'));
      const tools = registry.getAllTools('/cwd');
      expect(tools).toHaveLength(3);
      expect(tools.map((t: any) => t.name)).toEqual(['tool1', 'tool2', 'tool3']);
    });

    it('should pass cwd to getTools', () => {
      let capturedCwd: string | undefined;
      const ext = new MockExtension([]);
      ext.getTools = (cwd: string) => {
        capturedCwd = cwd;
        return [];
      };
      registry.register(ext);
      registry.getAllTools('/test/cwd');
      expect(capturedCwd).toBe('/test/cwd');
    });
  });

  describe('initializeAll', () => {
    it('should call initialize on extensions that have it', async () => {
      const ext = new MockExtension([]);
      registry.register(ext);
      await registry.initializeAll('/cwd');
      expect(ext.initCalled).toBe(true);
    });

    it('should continue if initialize throws', async () => {
      const badExt = {
        name: 'bad',
        version: '1.0.0',
        getTools: () => [],
        initialize: () => { throw new Error('fail'); }
      } as Extension;
      const goodExt = new MockExtension([]);
      registry.register(badExt);
      registry.register(goodExt);
      await registry.initializeAll('/cwd');
      expect(goodExt.initCalled).toBe(true);
    });
  });

  describe('disposeAll', () => {
    it('should call dispose on extensions that have it', async () => {
      const ext = new MockExtension([]);
      registry.register(ext);
      await registry.disposeAll();
      expect(ext.disposeCalled).toBe(true);
    });

    it('should clear extensions after dispose', async () => {
      const ext = new MockExtension([]);
      registry.register(ext);
      await registry.disposeAll();
      expect(registry.count).toBe(0);
    });
  });

  describe('listExtensions', () => {
    it('should return all registered extension names', () => {
      registry.register(new MockExtension([], 'a'));
      registry.register(new MockExtension([], 'b'));
      const names = registry.listExtensions();
      expect(names).toHaveLength(2);
    });
  });

  describe('getExtension', () => {
    it('should return extension by name', () => {
      const ext = new MockExtension([]);
      registry.register(ext);
      expect(registry.getExtension('mock')).toBe(ext);
    });

    it('should return undefined for unknown name', () => {
      expect(registry.getExtension('unknown')).toBeUndefined();
    });
  });
});
