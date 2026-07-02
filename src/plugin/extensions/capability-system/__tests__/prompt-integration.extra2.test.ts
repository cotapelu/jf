import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the registry module used by prompt-integration
vi.mock('../registry', () => {
  const mockCapability = {
    id: 'test.cap',
    name: 'Test Capability',
    description: 'Test Cap Description',
    pluginId: 'test',
    promptGuidelines: ['Guideline 1', 'Guideline 2'],
    tags: ['test'],
    dependencies: [],
    parameters: {}
  };

  const mockRegistry = {
    listAll: vi.fn(() => [mockCapability]),
    listByTag: vi.fn((tag: string) => {
      if (tag === 'test') return [mockCapability];
      return [];
    }),
    has: vi.fn((id: string) => id === mockCapability.id),
    getSystemPromptSection: vi.fn(() => 'Formatted capabilities section')
  };

  return { getCapabilityRegistry: vi.fn(() => mockRegistry) };
});

import {
  enhancePromptWithCapabilities,
  generateSlashCommands,
  parseSlashCommand,
  getCapabilitiesSection,
  createCapabilityDiscoveryCapability
} from '../prompt-integration';

describe('prompt-integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enhancePromptWithCapabilities', () => {
    it('inserts section before ## Guidelines', () => {
      const base = "Hello\n\n## Guidelines\n- be good";
      const result = enhancePromptWithCapabilities(base);
      expect(result).toContain('Formatted capabilities section');
      expect(result).toMatch(/Formatted capabilities section[\s\S]*## Guidelines/);
    });

    it('inserts section before ## Notes if no Guidelines', () => {
      const base = "Hello\n\n## Notes\n- note";
      const result = enhancePromptWithCapabilities(base);
      expect(result).toMatch(/Formatted capabilities section[\s\S]*## Notes/);
    });

    it('appends section if no Guidelines or Notes', () => {
      const base = "Hello";
      const result = enhancePromptWithCapabilities(base);
      expect(result).toContain('Formatted capabilities section');
      expect(result).includes('Hello');
    });
  });

  describe('generateSlashCommands', () => {
    it('returns correct command objects', () => {
      const cmds = generateSlashCommands();
      expect(cmds).toHaveLength(1);
      expect(cmds[0]).toEqual({
        command: '/test.cap',
        description: 'Test Cap Description',
        capabilityId: 'test.cap'
      });
    });

    it('sorts by name when requested', () => {
      // Single capability, order is same
      const cmds = generateSlashCommands('name');
      expect(cmds[0].command).toBe('/test.cap');
    });
  });

  describe('parseSlashCommand', () => {
    it('returns capabilityId for valid command', () => {
      expect(parseSlashCommand('/test.cap')).toBe('test.cap');
    });

    it('returns null for non-slash input', () => {
      expect(parseSlashCommand('test.cap')).toBeNull();
    });

    it('returns null for unknown command', () => {
      expect(parseSlashCommand('/unknown')).toBeNull();
    });
  });

  describe('getCapabilitiesSection', () => {
    it('returns the section string', () => {
      const section = getCapabilitiesSection();
      expect(section).toBe('Formatted capabilities section');
    });
  });

  describe('createCapabilityDiscoveryCapability', () => {
    it('execute returns list of capabilities (no filter)', async () => {
      const cap = createCapabilityDiscoveryCapability();
      const result = await cap.execute('id', {}, null, null, {});
      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      const text = result.content[0].text;
      const parsed = JSON.parse(text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe('test.cap');
      expect(parsed[0].description).toBe('Test Cap Description');
      expect(parsed[0].guidelines).toEqual(['Guideline 1', 'Guideline 2']);
      expect(result.details).toEqual({ count: 1, filter: undefined });
    });

    it('execute filters by tag', async () => {
      const cap = createCapabilityDiscoveryCapability();
      const result = await cap.execute('id', { tag: 'test' }, null, null, {});
      expect(result.isError).toBe(false);
      expect(result.details).toEqual({ count: 1, filter: 'test' });
    });
  });
});
