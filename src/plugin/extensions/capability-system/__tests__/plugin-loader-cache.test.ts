import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginLoader } from '../plugin-loader.js';

describe('PluginLoader cache clearing', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    loader = new PluginLoader({ pluginsDir: '/nonexistent' });
  });

  it('should remove entry from resolveCache', async () => {
    const fakeModule = {};
    const fileUrl = 'file:///some/path.js';
    (loader as any).resolveCache.set(fileUrl, { module: fakeModule, timestamp: Date.now() });

    await (loader as any).clearModuleCache(fileUrl);

    expect((loader as any).resolveCache.has(fileUrl)).toBe(false);
  });

  it('should not throw if cache entry missing', async () => {
    const fileUrl = 'file:///missing.js';
    // No entry set
    await expect((loader as any).clearModuleCache(fileUrl)).resolves.toBeUndefined();
  });
});
