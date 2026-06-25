import { describe, it, expect } from 'vitest';
import { createYourTool } from './tool-template.js';

type ToolResult = {
  isError: boolean;
  content: Array<{ type: string; text: string }>;
};

describe('tool-template (basic)', () => {
  it('should create tool definition with correct name and label', () => {
    const tool = createYourTool();
    expect(tool.name).toBe('tool_template');
    expect(tool.label).toBe('Tool Template');
  });

  it('should have correct description and parameters', () => {
    const tool = createYourTool();
    expect(tool.description).toContain('Multi-command tool');
    expect(tool.parameters).toEqual({
      type: 'object',
      properties: {
        command: {
          type: 'string',
          enum: ['example_command', 'another_command', 'dummy_test', 'failing_command', 'empty_meta_cmd'],
          description: 'Tên sub-command để thực thi'
        },
        args: {
          type: 'object',
          description: 'Arguments cho command cụ thể (xem schema của từng command)'
        }
      },
      required: ['command', 'args']
    });
  });

  it('should include commandMeta with example_command metadata', () => {
    const tool = createYourTool();
    // @ts-ignore - commandMeta is added by the tool
    expect(tool.commandMeta).toBeDefined();
    // @ts-ignore
    expect(tool.commandMeta.example_command).toBeDefined();
    // @ts-ignore
    expect(tool.commandMeta.example_command.description).toBe('Mô tả ngắn về command này');
    // @ts-ignore
    expect(tool.commandMeta.example_command.schema).toBeDefined();
    // @ts-ignore
    expect(tool.commandMeta.example_command.examples).toContain('your_tool_name({ command: \'example_command\', args: { input: \'data.txt\' } })');
  });

  it('should include commandMeta with another_command metadata', () => {
    const tool = createYourTool();
    // @ts-ignore
    expect(tool.commandMeta.another_command).toBeDefined();
    // @ts-ignore
    expect(tool.commandMeta.another_command.description).toBe('Một command khác');
    // @ts-ignore
    expect(tool.commandMeta.another_command.schema).toBeDefined();
    // @ts-ignore
    expect(tool.commandMeta.another_command.examples).toContain('your_tool_name({ command: \'another_command\', args: { files: [\'a.txt\', \'b.txt\'] } })');
  });

  it('execute should return error for unknown command', async () => {
    const tool = createYourTool();
    // @ts-ignore - testing invalid command with minimal context
    const result = (await tool.execute('id', { command: 'unknown', args: {} }, undefined, undefined, {})) as ToolResult;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown command');
    expect(result.content[0].text).toContain('example_command, another_command, dummy_test, failing_command');
  });

  it('execute with empty args should return discovery help', async () => {
    const tool = createYourTool();
    // @ts-ignore - testing with empty args but required schema
    const result = (await tool.execute('id', { command: 'example_command', args: {} }, undefined, undefined, {})) as ToolResult;
    expect(result.isError).toBe(false);
    const text = result.content[0].text;
    expect(text).toContain('example_command');
    expect(text).toContain('Description');
    expect(text).toContain('Arguments:');
    expect(text).toContain('input* (string): Đường dẫn file đầu vào');
  });
});
