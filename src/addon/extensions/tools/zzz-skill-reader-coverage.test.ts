import { describe, it, expect, vi, beforeAll } from 'vitest';

describe('skill-reader coverage (unreadable skills dir)', () => {
  beforeAll(() => {
    // Clear module cache to ensure fresh import with mock
    vi.resetModules();
  });

  // Mock fs.readdirSync to throw an error
  vi.mock('fs', () => ({
    readdirSync: () => { throw new Error('permission denied'); }
  }));

  let createSkillLoaderTool: any;

  beforeAll(async () => {
    const mod = await import('./skill-reader.js');
    createSkillLoaderTool = mod.createSkillLoaderTool;
  });

  it('should handle unreadable skills directory and show no skills', () => {
    const tool = createSkillLoaderTool();
    const guidelines = tool.promptGuidelines as string[];
    expect(guidelines).toContain('  No skills currently available.');
  });
});
