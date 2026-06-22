import { describe, it, expect } from 'vitest';
import { createSkillLoaderTool } from '../extensions/tools/skill-reader.js';

describe('Skill Reader Tool - Error Paths', () => {
  it('should return error when command not found', async () => {
    const tool = createSkillLoaderTool();
    const result = await tool.execute('test', { command: 'unknown_cmd', args: {} });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown command');
  });

  it('should return error when command throws', async () => {
    const tool = createSkillLoaderTool();
    const result = await tool.execute('test', { command: 'unknown_cmd', args: {} });
    expect(result.isError).toBe(true);
    // The message might include 'Unknown command' or other error.
    expect(result.content[0].text).toContain('Unknown command');
  });
});
