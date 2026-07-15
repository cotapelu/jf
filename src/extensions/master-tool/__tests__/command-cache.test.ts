import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandCache, getGlobalCache, setGlobalCache, resetGlobalCache } from '../utils/command-cache.js';
import type { CommandModule, CommandRegistryEntry } from '../types/command-module.js';

// Mock module
function createMockModule(name: string): CommandModule {
  return {
    metadata: { name, category: 'test', description: 'Mock' },
    schema: {} as any,
    execute: async () => ({ code: 0, stdout: '', stderr: '' })
  };
}

describe('CommandCache', () => {
  let cache: CommandCache;

  beforeEach(() => {
    cache = new CommandCache({ ttl: 1000, maxSize: 3 });
  });

  describe('set and get', () => {
    it('should store and retrieve module', () => {
      const mod = createMockModule('test.cmd');
      cache.set('test.cmd', mod, mod.metadata);
      const got = cache.get('test.cmd');
      expect(got).toBe(mod);
    });

    it('should return undefined for missing key', () => {
      const got = cache.get('missing');
      expect(got).toBeUndefined();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when exceeding maxSize', () => {
      const m1 = createMockModule('cmd1');
      const m2 = createMockModule('cmd2');
      const m3 = createMockModule('cmd3');
      const m4 = createMockModule('cmd4');

      cache.set('cmd1', m1);
      cache.set('cmd2', m2);
      cache.set('cmd3', m3);
      // At capacity: 3 entries (cmd1 oldest)
      expect(cache.getStats().size).toBe(3);

      cache.set('cmd4', m4); // Evicts cmd1
      expect(cache.get('cmd1')).toBeUndefined();
      expect(cache.get('cmd2')).toBe(m2);
      expect(cache.get('cmd3')).toBe(m3);
      expect(cache.get('cmd4')).toBe(m4);
    });

    it('should move accessed entry to end (most recent)', () => {
      const m1 = createMockModule('cmd1'), m2 = createMockModule('cmd2'), m3 = createMockModule('cmd3');
      cache.set('cmd1', m1); cache.set('cmd2', m2); cache.set('cmd3', m3);
      cache.get('cmd1');
      const m4 = createMockModule('cmd4');
      cache.set('cmd4', m4);
      expect(cache.get('cmd1')).toBe(m1);
      expect(cache.get('cmd2')).toBeUndefined();
      expect(cache.get('cmd3')).toBe(m3);
      expect(cache.get('cmd4')).toBe(m4);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const cacheFast = new CommandCache({ ttl: 50, maxSize: 10 });
      const mod = createMockModule('test');
      cacheFast.set('test', mod);

      // Immediately available
      expect(cacheFast.get('test')).toBe(mod);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));

      expect(cacheFast.get('test')).toBeUndefined();
    });
  });

  describe('markError', () => {
    it('should increment errorCount and set lastError', () => {
      const mod = createMockModule('cmd');
      cache.set('cmd', mod);

      cache.markError('cmd', 'Something broke');

      const stats = cache.getStats();
      const entry = stats.entries.find(e => e.key === 'cmd');
      expect(entry?.errorCount).toBe(1);
      expect(entry?.lastError).toBe('Something broke');
    });

    it('should move errored entry to end (lower priority) and evict when full', () => {
      const m1 = createMockModule('cmd1'), m2 = createMockModule('cmd2'), m3 = createMockModule('cmd3');
      cache.set('cmd1', m1); cache.set('cmd2', m2); cache.set('cmd3', m3);
      cache.markError('cmd1');
      const m4 = createMockModule('cmd4');
      cache.set('cmd4', m4);
      expect(cache.get('cmd1')).toBe(m1);
      expect(cache.get('cmd2')).toBeUndefined();
      expect(cache.get('cmd3')).toBe(m3);
      expect(cache.get('cmd4')).toBe(m4);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('a', createMockModule('a'));
      cache.set('b', createMockModule('b'));
      expect(cache.getStats().size).toBe(2);

      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('invalidate', () => {
    it('should remove specific key', () => {
      cache.set('a', createMockModule('a'));
      expect(cache.get('a')).toBeDefined();

      const removed = cache.invalidate('a');
      expect(removed).toBe(true);
      expect(cache.get('a')).toBeUndefined();
    });

    it('should return false for missing key', () => {
      const removed = cache.invalidate('missing');
      expect(removed).toBe(false);
    });
  });

  describe('invalidateCategory', () => {
    it('should remove all entries in category', () => {
      cache.set('git.status', createMockModule('git.status'), { name: 'git.status', category: 'git' });
      cache.set('git.commit', createMockModule('git.commit'), { name: 'git.commit', category: 'git' });
      cache.set('dev.test', createMockModule('dev.test'), { name: 'dev.test', category: 'dev' });

      cache.invalidateCategory('git');

      expect(cache.get('git.status')).toBeUndefined();
      expect(cache.get('git.commit')).toBeUndefined();
      expect(cache.get('dev.test')).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      const now = Date.now();
      const mod = createMockModule('test');
      cache.set('test', mod, { name: 'test', category: 'test' });

      const stats = cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].name).toBe('test');
      expect(stats.entries[0].category).toBe('test');
      expect(stats.entries[0].loadCount).toBe(1);
      expect(stats.entries[0].errorCount).toBe(0);
      expect(stats.entries[0].ageMs).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array when cache empty', () => {
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toEqual([]);
    });
  });

  describe('Global Cache', () => {
    it('should create singleton on first call', () => {
      resetGlobalCache();
      const cache1 = getGlobalCache();
      expect(cache1).toBeInstanceOf(CommandCache);
      const cache2 = getGlobalCache();
      expect(cache2).toBe(cache1);
    });

    it('should allow overriding singleton', () => {
      resetGlobalCache();
      const custom = new CommandCache({ ttl: 1234 });
      setGlobalCache(custom);
      const retrieved = getGlobalCache();
      expect(retrieved).toBe(custom);
    });
  });
});
