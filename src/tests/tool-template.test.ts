import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createYourTool } from '../extensions/tools/tool-template.js';
import type { ToolResult } from '@earendil-works/pi-coding-agent';
import exampleCmd from '../extensions/tools/tool-template/example-command.js';
import anotherCmd from '../extensions/tools/tool-template/another-command.js';

// Mock command modules
vi.mock('../extensions/tools/tool-template/example-command.js', () => ({
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
    execute: vi.fn().mockImplementation(async (args: { input: string }) => ({
      stdout: `Example command executed with input: ${args.input}`,
      stderr: '',
      code: 0,
    })),
  },
}));

vi.mock('../extensions/tools/tool-template/another-command.js', () => ({
  schema: {
    type: 'object',
    properties: { files: { type: 'array', items: { type: 'string' } } },
    required: ['files'],
  },
  default: {
    schema: {
      type: 'object',      properties: { files: { type: 'array', items: { type: 'string' } } },
      required: ['files'],
    },
    execute: vi.fn().mockImplementation(async (args: { files: string[] }) => ({
      stdout: `Another command executed with files: ${args.files.join(', ')}`,
      stderr: '',
      code: 0,
    })),
  },
}));

describe('Tool Template', () => {
  let tool: ReturnType<typeof createYourTool>;

  beforeEach(() => {
    tool = createYourTool();
  });

  it('should reject unknown command', async () => {
    const result = await tool.execute('test', { command: 'unknown_cmd', args: {} }, undefined, undefined, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown command: unknown_cmd');
  });

  it('should return help for example_command with empty args', async () => {
    const result = (await tool.execute('test', { command: 'example_command', args: {} }, undefined, undefined, {})) as ToolResult<'text'>;
    expect(result.isError).toBe(false);
    expect(result.details).toMatchObject({ mode: 'discovery', command: 'example_command' });
    expect(result.content[0].text).toContain('=== example_command ===');
    expect(result.content[0].text).toContain('input');
  });

  it('should return help for another_command with empty args', async () => {
    const result = (await tool.execute('test', { command: 'another_command', args: {} }, undefined, undefined, {})) as ToolResult<'text'>;
    expect(result.isError).toBe(false);
    expect(result.details).toMatchObject({ mode: 'discovery', command: 'another_command' });
    expect(result.content[0].text).toContain('=== another_command ===');
    expect(result.content[0].text).toContain('files');
  });

  it('should execute example_command successfully', async () => {
    const result = await tool.execute('test', { command: 'example_command', args: { input: 'data.txt' } }, undefined, undefined, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Example command executed with input: data.txt');
    expect(result.details).toHaveProperty('stdout', 'Example command executed with input: data.txt');
    expect(result.details).toHaveProperty('code', 0);
  });

  it('should execute another_command successfully', async () => {
    const result = await tool.execute('test', { command: 'another_command', args: { files: ['a.txt', 'b.txt'] } }, undefined, undefined, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Another command executed with files: a.txt, b.txt');
  });

  it('should handle command execution failure (non-zero exit)', async () => {
    // Override mock for failure
    exampleCmd.execute.mockResolvedValueOnce({
      stdout: '',
      stderr: 'Something went wrong',
      code: 1,
    });

    const result = await tool.execute('test', { command: 'example_command', args: { input: 'file.txt' } }, undefined, undefined, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Something went wrong');
  });
});
