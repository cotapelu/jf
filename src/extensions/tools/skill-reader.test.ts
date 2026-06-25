import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSkillLoaderTool, registerSkillReaderExtension } from './skill-reader.js';

type ToolResult = {
  isError: boolean;
  content: Array<{ type: string; text: string }>;
};

describe('skill-reader tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create tool definition with correct metadata', () => {
    const tool = createSkillLoaderTool();
    expect(tool.name).toBe('skill_reader');
    expect(tool.label).toBe('Skill Reader');
    expect(tool.description).toContain('Retrieve skill .md');
    expect(tool.parameters).toBeDefined();
    expect((tool.parameters as any).properties.command.enum).toContain('read_skill');
  });

  it('execute with unknown command returns error', async () => {
    const tool = createSkillLoaderTool();
    const result = (await tool.execute('test-call', { command: 'unknown', args: {} }, undefined, undefined, {})) as any;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown command');
  });

  it('execute with empty args returns discovery help for read_skill', async () => {
    const tool = createSkillLoaderTool();
    const result = (await tool.execute('test-call', { command: 'read_skill', args: {} }, undefined, undefined, {})) as any;
    expect(result.isError).toBe(false);
    const text = result.content[0].text;
    expect(text).toContain('read_skill');
    expect(text).toContain('Description');
    expect(text).toContain('Arguments');
  });

  it('registerSkillReaderExtension registers tool with API', () => {
    const api = { registerTool: vi.fn() };
    registerSkillReaderExtension(api);
    expect(api.registerTool).toHaveBeenCalledTimes(1);
    expect(api.registerTool).toHaveBeenCalledWith(expect.any(Object));
  });

  it('execute with real command loads skill content (integration)', async () => {
    const tool = createSkillLoaderTool();
    const result = (await tool.execute('test-call', { command: 'read_skill', args: { skill: 'audit' } }, undefined, undefined, {})) as any;
    if (result.isError) {
      console.error('Integration error:', result.content[0].text);
    }
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('# Audit');
  });

  it('should return error for non-existent skill', async () => {
    const tool = createSkillLoaderTool();
    const result = (await tool.execute('test-call', { command: 'read_skill', args: { skill: 'nonexistent-nonexistent' } }, undefined, undefined, {})) as any;
    expect(result.isError).toBe(true);
    expect(result.details?.stderr || result.content[0].text).toContain('not found');
  });

  // =========================================================================
  // Edge case tests for coverage
  // =========================================================================

  it('should handle loader module throw during import', async () => {
    vi.doMock('./skill-reader/read-skill.js', () => { throw new Error('import fail'); });
    const tool = createSkillLoaderTool();
    const result = (await tool.execute('test-call', { command: 'read_skill', args: { skill: 'audit' } }, undefined, undefined, {})) as any;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('error');
    vi.unmock('./skill-reader/read-skill.js');
  });

  it('should handle command module missing execute function', async () => {
    // Mock module with execute and executeLoadSkill explicitly undefined
    vi.doMock('./skill-reader/read-skill.js', () => ({
      execute: undefined,
      executeLoadSkill: undefined,
    }));
    const tool = createSkillLoaderTool();
    const result = (await tool.execute('test-call', { command: 'read_skill', args: { skill: 'audit' } }, undefined, undefined, {})) as any;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('missing execute function');
    vi.unmock('./skill-reader/read-skill.js');
  });

  it('should handle command execute rejection', async () => {
    vi.doMock('./skill-reader/read-skill.js', () => ({
      execute: vi.fn().mockRejectedValue(new Error('execution rejected'))
    }));
    const tool = createSkillLoaderTool();
    const result = (await tool.execute('test-call', { command: 'read_skill', args: { skill: 'audit' } }, undefined, undefined, {})) as any;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('execution rejected');
    vi.unmock('./skill-reader/read-skill.js');
  });

  it('should handle command returning non-zero exit code', async () => {
    vi.doMock('./skill-reader/read-skill.js', () => ({
      execute: vi.fn().mockResolvedValue({ stdout: 'output', stderr: 'failure', code: 1 })
    }));
    const tool = createSkillLoaderTool();
    const result = (await tool.execute('test-call', { command: 'read_skill', args: { skill: 'audit' } }, undefined, undefined, {})) as any;
    expect(result.isError).toBe(true);
    expect(result.details?.stderr).toContain('failure');
    vi.unmock('./skill-reader/read-skill.js');
  });

  it('should handle command using executeLoadSkill alias', async () => {
    vi.doMock('./skill-reader/read-skill.js', () => ({
      execute: undefined,
      executeLoadSkill: vi.fn().mockResolvedValue({ stdout: 'alias works', stderr: '', code: 0 })
    }));
    const tool = createSkillLoaderTool();
    const result = await tool.execute('test-call', { command: 'read_skill', args: { skill: 'audit' } }, undefined, undefined, {});
    expect(result.content[0].text).toBe('alias works');
    expect(result.isError).toBe(false);
    vi.unmock('./skill-reader/read-skill.js');
  });
});
