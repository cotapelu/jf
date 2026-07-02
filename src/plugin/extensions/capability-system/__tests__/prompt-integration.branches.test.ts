#!/usr/bin/env node
/**
 * Branch coverage for prompt-integration
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Shared mutable mock registry
const MOCK_REGISTRY = {
  listAll: vi.fn(),
  listByTag: vi.fn(),
  has: vi.fn(),
  getSystemPromptSection: vi.fn()
};

vi.mock('../registry', () => {
  return { getCapabilityRegistry: vi.fn(() => MOCK_REGISTRY) };
});

import {
  enhancePromptWithCapabilities,
  generateSlashCommands,
  parseSlashCommand,
  getCapabilitiesSection,
  createCapabilityDiscoveryCapability
} from '../prompt-integration';

beforeEach(() => {
  vi.clearAllMocks();
  MOCK_REGISTRY.listAll.mockReturnValue([]);
  MOCK_REGISTRY.listByTag.mockReturnValue([]);
  MOCK_REGISTRY.has.mockReturnValue(false);
  MOCK_REGISTRY.getSystemPromptSection.mockReturnValue(undefined);
});

describe('prompt-integration branch coverage', () => {
  describe('enhancePromptWithCapabilities', () => {
    it('returns base when capabilitiesSection is null', () => {
      MOCK_REGISTRY.getSystemPromptSection.mockReturnValue(null as any);
      const result = enhancePromptWithCapabilities('Hello');
      expect(result).toBe('Hello');
    });

    it('returns base when capabilitiesSection is empty string', () => {
      MOCK_REGISTRY.getSystemPromptSection.mockReturnValue('');
      const result = enhancePromptWithCapabilities('Hello');
      expect(result).toBe('Hello');
    });

    it('returns base when capabilitiesSection is undefined', () => {
      MOCK_REGISTRY.getSystemPromptSection.mockReturnValue(undefined);
      const result = enhancePromptWithCapabilities('Hello');
      expect(result).toBe('Hello');
    });
  });

  describe('parseSlashCommand', () => {
    it('returns null for whitespace-only after slash', () => {
      expect(parseSlashCommand('/   ')).toBeNull();
    });

    it('returns null for slash with tabs', () => {
      expect(parseSlashCommand('/\t')).toBeNull();
    });

    it('converts spaces to dots and returns id when exists', () => {
      MOCK_REGISTRY.has.mockImplementation((id: string) => id === 'foo.bar');
      expect(parseSlashCommand('/foo bar')).toBe('foo.bar');
      expect(MOCK_REGISTRY.has).toHaveBeenCalledWith('foo.bar');
    });

    it('returns null when converted id does not exist', () => {
      MOCK_REGISTRY.has.mockReturnValue(false);
      expect(parseSlashCommand('/foo bar')).toBeNull();
      expect(MOCK_REGISTRY.has).toHaveBeenCalledWith('foo.bar');
    });
  });

  describe('generateSlashCommands', () => {
    const makeCap = (id: string, name: string, pluginId: string) => ({
      id,
      name,
      pluginId,
      description: '',
      promptGuidelines: [],
      tags: [],
      dependencies: []
    });

    beforeEach(() => {
      MOCK_REGISTRY.listAll.mockReturnValue([]);
    });

    it('sorts by plugin (default) with different plugins', () => {
      const caps = [
        makeCap('b.cap', 'B Cap', 'plugin-b'),
        makeCap('a.cap', 'A Cap', 'plugin-a')
      ];
      MOCK_REGISTRY.listAll.mockReturnValue(caps);
      const result = generateSlashCommands();
      expect(result.map(c => c.capabilityId)).toEqual(['a.cap', 'b.cap']);
    });

    it('sorts by short name when same plugin', () => {
      const caps = [
        makeCap('z.zeta', 'Zeta', 'same-plugin'),
        makeCap('a.alpha', 'Alpha', 'same-plugin')
      ];
      MOCK_REGISTRY.listAll.mockReturnValue(caps);
      const result = generateSlashCommands();
      expect(result.map(c => c.capabilityId)).toEqual(['a.alpha', 'z.zeta']);
    });

    it('sorts by name when requested', () => {
      const caps = [
        makeCap('id.z', 'Zebra', 'zzz'),
        makeCap('id.a', 'Alpha', 'aaa')
      ];
      MOCK_REGISTRY.listAll.mockReturnValue(caps);
      const result = generateSlashCommands('name');
      expect(result.map(c => c.capabilityId)).toEqual(['id.a', 'id.z']);
    });
  });

  describe('createCapabilityDiscoveryCapability', () => {
    it('execute handles empty list gracefully', async () => {
      MOCK_REGISTRY.listAll.mockReturnValue([]);
      const cap = createCapabilityDiscoveryCapability();
      const result = await cap.execute('id', {}, null, null, {});
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('[]');
      expect(result.details).toEqual({ count: 0, filter: undefined });
    });

    it('execute includes tag when filter provided', async () => {
      MOCK_REGISTRY.listByTag.mockReturnValue([{ id: 't', name: 'T', description: '', pluginId: 'p', promptGuidelines: [], tags: [], dependencies: [] }]);
      const cap = createCapabilityDiscoveryCapability();
      const result = await cap.execute('id', { tag: 't' }, null, null, {});
      expect(result.isError).toBe(false);
      expect(result.details).toEqual({ count: 1, filter: 't' });
    });
  });
});
