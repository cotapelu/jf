#!/usr/bin/env node
/**
 * Branch coverage for prompt-integration: both Guidelines and Notes present.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the registry
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
    listByTag: vi.fn((tag: string) => tag === 'test' ? [mockCapability] : []),
    has: vi.fn((id: string) => id === mockCapability.id),
    getSystemPromptSection: vi.fn(() => 'Capabilities Section')
  };

  return { getCapabilityRegistry: vi.fn(() => mockRegistry) };
});

import {
  enhancePromptWithCapabilities,
} from '../prompt-integration';

describe('prompt-integration both sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts capabilities before Guidelines when both Guidelines and Notes exist', () => {
    const base = `Hello\n\n## Guidelines\n- be good\n\n## Notes\n- note`;
    const result = enhancePromptWithCapabilities(base);
    expect(result).toMatch(/Capabilities Section[\s\S]*## Guidelines/);
    // Ensure Notes still present after Guidelines
    expect(result).toMatch(/## Guidelines[\s\S]*## Notes/);
    // Ensure capabilities not inserted before Notes only
    const guidelinesIndex = result.indexOf('## Guidelines');
    const capabilitiesIndex = result.indexOf('Capabilities Section');
    const notesIndex = result.indexOf('## Notes');
    expect(capabilitiesIndex).toBeLessThan(guidelinesIndex);
    expect(guidelinesIndex).toBeLessThan(notesIndex);
  });
});
