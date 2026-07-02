import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandRegistry } from '../command-registry.js';

describe('Dev Test Command', () => {
  let registry: CommandRegistry;

  beforeEach(async () => {
    registry = new CommandRegistry();
    await registry.initialize();
  });

  const mockCtx = (stdout: string, code = 0) => ({
    cwd: '/tmp',
    exec: vi.fn().mockResolvedValue({ code, stdout, stderr: '' })
  } as any);

  const getText = (result: any) => result.content.filter(c => c.type === 'text').map(c => c.text).join('\n');

  it('should run npm test and return output', async () => {
    const result = await registry.execute('dev.test', { coverage: true } as any, {
      toolCallId: '1',
      signal: undefined,
      onUpdate: undefined,
      ctx: mockCtx('> echo "test"\n\nTest Files  1 passed (1)\n'),
      maxOutputSize: 1024 * 1024
    });
    expect(result.isError).toBe(false);
    const text = getText(result);
    expect(text).toContain('Test Files');
    // details.data includes parsed stats
    expect(result.details.data).toBeDefined();
  });

  it('should handle file filtering', async () => {
    const result = await registry.execute('dev.test', { files: ['src/'] } as any, {
      toolCallId: '1',
      signal: undefined,
      onUpdate: undefined,
      ctx: mockCtx('> vitest run src/'),
      maxOutputSize: 1024 * 1024
    });
    expect(result.isError).toBe(false);
    // The command is dev.test
    expect(result.details.command).toBe('dev.test');
  });

  it('should handle npm test failure', async () => {
    const result = await registry.execute('dev.test', {} as any, {
      toolCallId: '1',
      signal: undefined,
      onUpdate: undefined,
      ctx: mockCtx('FAIL  test.ts\nExpected: 1', 1),
      maxOutputSize: 1024 * 1024
    });
    expect(result.isError).toBe(true);
    // On failure, stderr may be empty; check stdout contains failure
    const text = getText(result);
    expect(text).toContain('FAIL');
  });
});
