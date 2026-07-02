#!/usr/bin/env node
/**
 * Capability Registry Tests
 *
 * Unit tests for the capability registry singleton and instance methods.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRegistry, getCapabilityRegistry, resetCapabilityRegistry } from '../registry.js';
import type { Capability } from '../types.js';

// Helper to create a mock capability
function createMockCapability(overrides: Partial<Capability> = {}): Capability {
  return {
    id: 'test.capability',
    name: 'Test Capability',
    description: 'A test capability',
    pluginId: 'test',
    promptSnippet: 'test()',
    promptGuidelines: ['Test guideline'],
    tags: [],
    parameters: { type: 'object', properties: {} },
    execute: async () => ({ content: [], details: {} }),
    ...overrides,
  };
}

describe('CapabilityRegistry (Isolated Instance)', () => {
  let registry: ReturnType<typeof createRegistry>;

  beforeEach(() => {
    // Create fresh isolated registry for each test
    registry = createRegistry();
  });

  describe('registration', () => {
    it('should register a new capability', () => {
      const cap = createMockCapability({ id: 'my.capability' });
      registry.register(cap);
      expect(registry.has('my.capability')).toBe(true);
      expect(registry.get('my.capability')).toBe(cap);
    });

    it('should throw if registering duplicate id', () => {
      const cap = createMockCapability({ id: 'dup.capability' });
      registry.register(cap);
      expect(() => registry.register(cap)).toThrow(`Capability 'dup.capability' is already registered`);
    });

    it('should unregister capability', () => {
      const cap = createMockCapability({ id: 'to.remove' });
      registry.register(cap);
      expect(registry.has('to.remove')).toBe(true);
      const result = registry.unregister('to.remove');
      expect(result).toBe(true);
      expect(registry.has('to.remove')).toBe(false);
    });

    it('should return false when unregistering non-existent capability', () => {
      const result = registry.unregister('non.existent');
      expect(result).toBe(false);
    });

    it('should track plugin capabilities', () => {
      const cap1 = createMockCapability({ id: 'plugin1.cap1', pluginId: 'plugin1' });
      const cap2 = createMockCapability({ id: 'plugin1.cap2', pluginId: 'plugin1' });
      const cap3 = createMockCapability({ id: 'plugin2.cap1', pluginId: 'plugin2' });

      registry.register(cap1);
      registry.register(cap2);
      registry.register(cap3);

      const plugin1Caps = registry.listByPlugin('plugin1');
      expect(plugin1Caps).toHaveLength(2);
      expect(plugin1Caps.map(c => c.id).sort()).toEqual(['plugin1.cap1', 'plugin1.cap2']);

      const plugin2Caps = registry.listByPlugin('plugin2');
      expect(plugin2Caps).toHaveLength(1);
    });

    it('should cleanup pluginCapabilities map when empty', () => {
      const cap = createMockCapability({ id: 'temp.cap', pluginId: 'temp' });
      registry.register(cap);
      expect(registry.listByPlugin('temp')).toHaveLength(1);
      registry.unregister('temp.cap');
      expect(registry.listByPlugin('temp')).toHaveLength(0);
    });
  });

  describe('lookup', () => {
    beforeEach(() => {
      const cap1 = createMockCapability({ id: 'cap.one', name: 'Cap One' });
      const cap2 = createMockCapability({ id: 'cap.two', name: 'Cap Two', tags: ['tagged'] });
      registry.register(cap1);
      registry.register(cap2);
    });

    it('should get capability by id', () => {
      const cap = registry.get('cap.one');
      expect(cap?.name).toBe('Cap One');
    });

    it('should return undefined for non-existent id', () => {
      expect(registry.get('non.existent')).toBeUndefined();
    });

    it('should list all capabilities', () => {
      const all = registry.listAll();
      expect(all).toHaveLength(2);
    });

    it('should list by tag', () => {
      const tagged = registry.listByTag('tagged');
      expect(tagged).toHaveLength(1);
      expect(tagged[0].id).toBe('cap.two');
    });

    it('should search by name', () => {
      const results = registry.search('One');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('cap.one');
    });

    it('should search by description', () => {
      const results = registry.search('Two');
      expect(results).toHaveLength(1);
    });

    it('should search by id', () => {
      const results = registry.search('cap.two');
      expect(results).toHaveLength(1);
    });

    it('should search case-insensitive', () => {
      const results = registry.search('ONE');
      expect(results).toHaveLength(1);
    });

    it('should get capability ids', () => {
      const ids = registry.getCapabilityIds();
      expect(ids).toContain('cap.one');
      expect(ids).toContain('cap.two');
    });
  });

  describe('system prompt generation', () => {
    beforeEach(() => {
      const cap1 = createMockCapability({
        id: 'prompt.test.1',
        name: 'Prompt Test',
        description: 'Test capability for prompt',
        promptGuidelines: ['Use with caution', 'Always validate'],
        parameters: { type: 'object', properties: { input: { type: 'string' } } },
      });
      registry.register(cap1);
    });

    it('should generate system prompt section', () => {
      const section = registry.getSystemPromptSection({});
      expect(section).toContain('## Available Capabilities');
      expect(section).toContain('### Prompt Test');
      expect(section).toContain('ID: `prompt.test.1`');
      expect(section).toContain('Test capability for prompt');
      expect(section).toContain('**Guidelines:**');
      expect(section).toContain('- Use with caution');
      expect(section).toContain('**Parameters:**');
    });

    it('should filter by tag', () => {
      const cap = createMockCapability({ id: 'tagged.cap', tags: ['include'] });
      registry.register(cap);
      const section = registry.getSystemPromptSection({ filterTags: ['include'] });
      expect(section).toContain('tagged.cap');
    });

    it('should exclude by tag', () => {
      const cap = createMockCapability({ id: 'exclude.me', tags: ['excluded'] });
      registry.register(cap);
      const section = registry.getSystemPromptSection({ excludeTags: ['excluded'] });
      expect(section).not.toContain('exclude.me');
    });

    it('should sort by name', () => {
      const capA = createMockCapability({ id: 'sort.a', name: 'Zeta' });
      const capB = createMockCapability({ id: 'sort.b', name: 'Alpha' });
      registry.register(capA);
      registry.register(capB);
      const section = registry.getSystemPromptSection({ sortBy: 'name' });
      const alphaIndex = section.indexOf('Alpha');
      const zetaIndex = section.indexOf('Zeta');
      expect(alphaIndex).toBeLessThan(zetaIndex);
    });

    it('should limit capabilities', () => {
      // Register the cap from the main beforeEach
      for (let i = 0; i < 5; i++) {
        registry.register(createMockCapability({ id: `limit.cap.${i}`, name: `Cap ${i}` }));
      }
      const section = registry.getSystemPromptSection({ maxCapabilities: 3 });
      const matches = section.match(/###/g);
      // Number of capability headings (###) should be limited to 3 + the original
      expect(matches?.length).toBeLessThanOrEqual(4);
    });

    it('should return empty string if no capabilities', () => {
      const emptyRegistry = createRegistry();
      const section = emptyRegistry.getSystemPromptSection({});
      expect(section).toBe('');
    });
  });

  describe('statistics', () => {
    it('should return correct stats', () => {
      const cap1 = createMockCapability({ id: 'stat.1', pluginId: 'pluginA', tags: ['tag1', 'tag2'] });
      const cap2 = createMockCapability({ id: 'stat.2', pluginId: 'pluginA', tags: ['tag1'] });
      const cap3 = createMockCapability({ id: 'stat.3', pluginId: 'pluginB', tags: ['tag2'] });

      registry.register(cap1);
      registry.register(cap2);
      registry.register(cap3);

      const stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byPlugin).toEqual({ pluginA: 2, pluginB: 1 });
      expect(stats.byTag).toEqual({ tag1: 2, tag2: 2 });
    });
  });
});

describe('CapabilityRegistry (Global Singleton)', () => {
  beforeEach(() => {
    resetCapabilityRegistry();
  });

  it('should return same instance on multiple calls', () => {
    const r1 = getCapabilityRegistry();
    const r2 = getCapabilityRegistry();
    expect(r1).toBe(r2);
  });

  it('should share state between calls', () => {
    const r1 = getCapabilityRegistry();
    r1.register(createMockCapability({ id: 'global.test' }));
    const r2 = getCapabilityRegistry();
    expect(r2.has('global.test')).toBe(true);
  });
});
