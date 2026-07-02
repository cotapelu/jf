import { vi, describe, it, expect } from 'vitest';

describe('Tool Template Edge Cases', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should handle command module missing execute function', async () => {
    vi.doMock('../extensions/tools/tool-template/example-command.js', () => ({
      // named export for schema (required by tool's top-level import)
      schema: {
        type: 'object',
        properties: { input: { type: 'string' } },
        required: ['input'],
      },
      default: {
        schema: {
          type: 'object',
          properties: { input: { type: 'string' } },
          required: ['input'],
        },
        // no execute property
      }
    }));
    const { createYourTool } = await import('../extensions/tools/tool-template.js');
    const tool = createYourTool();
    // Provide non-empty args to trigger execution
    const result = await tool.execute('test', { command: 'example_command', args: { input: 'test' } }, undefined, undefined, {});
    expect(result.isError).toBe(true);
    // The error should indicate that execute is not a function or similar
    expect(result.content[0].text).toMatch(/execute.*not a function|Tool 'example_command' error/i);
    vi.unmock('../extensions/tools/tool-template/example-command.js');
  });

  it('should handle command execute rejection', async () => {
    vi.doMock('../extensions/tools/tool-template/example-command.js', () => ({
      schema: {
        type: 'object',
        properties: { input: { type: 'string' } },
        required: ['input'],
      },
      default: {
        schema: {
          type: 'object',
          properties: { input: { type: 'string' } },
          required: ['input'],
        },
        execute: vi.fn().mockRejectedValue(new Error('execution rejected'))
      }
    }));
    const { createYourTool } = await import('../extensions/tools/tool-template.js');
    const tool = createYourTool();
    const result = await tool.execute('test', { command: 'example_command', args: { input: 'test' } }, undefined, undefined, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('execution rejected');
    vi.unmock('../extensions/tools/tool-template/example-command.js');
  });
});
