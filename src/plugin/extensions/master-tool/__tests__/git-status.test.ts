import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandRegistry } from '../command-registry.js';

describe('Git Status Command', () => {
  let registry: CommandRegistry;

  beforeEach(async () => {
    registry = new CommandRegistry();
    await registry.initialize();
  });

  const mockCtx = (output: string, code = 0) => ({
    cwd: '/tmp',
    exec: vi.fn().mockResolvedValue({ code, stdout: output, stderr: '' })
  } as any);

  const getText = (result: any) => result.content.filter(c => c.type === 'text').map(c => c.text).join('\n');

  it('should handle empty status', async () => {
    const result = await registry.execute('git.status', {} as any, {
      toolCallId: '1',
      signal: undefined,
      onUpdate: undefined,
      ctx: mockCtx(''),
      maxOutputSize: 1024 * 1024
    });
    expect(result.isError).toBe(false);
    const text = getText(result);
    expect(text).toContain('Branch:');
    expect(text).toContain('Staged: 0');
    expect(text).toContain('Unstaged: 0');
    expect(text).toContain('Untracked: 0');
  });

  it('should parse branch and staged/untracked files', async () => {
    // Porcelain lines: status XY, space, file path
    const output = `## main...origin/main\nM  src/file.ts\n?? newfile.txt\nA  added.ts`;
    const result = await registry.execute('git.status', {} as any, {
      toolCallId: '1',
      signal: undefined,
      onUpdate: undefined,
      ctx: mockCtx(output),
      maxOutputSize: 1024 * 1024
    });
    expect(result.isError).toBe(false);
    const text = getText(result);
    expect(text).toContain('Branch: main');
    expect(text).toContain('Staged: 2');
    expect(text).toContain('M  src/file.ts'); // includes status code and file
    expect(text).toContain('A  added.ts');
    expect(text).toContain('Untracked: 1');
    expect(text).toContain('newfile.txt'); // untracked file listed without status code prefix in output (just path)
    // Unstaged count should be 0 because all changes are staged
    expect(text).toContain('Unstaged: 0');
  });

  it('should handle git error', async () => {
    const result = await registry.execute('git.status', {} as any, {
      toolCallId: '1',
      signal: undefined,
      onUpdate: undefined,
      ctx: mockCtx('fatal: not a git repository', 128),
      maxOutputSize: 1024 * 1024
    });
    expect(result.isError).toBe(true);
    const text = getText(result);
    expect(text).toContain('fatal');
  });

  it('should ignore porcelain arg (always uses porcelain)', async () => {
    const result = await registry.execute('git.status', { porcelain: false } as any, {
      toolCallId: '1',
      signal: undefined,
      onUpdate: undefined,
      ctx: mockCtx('## main\nM  file.ts'),
      maxOutputSize: 1024 * 1024
    });
    expect(result.isError).toBe(false);
    const text = getText(result);
    expect(text).toContain('Branch: main');
    expect(text).toContain('Staged: 1');
    expect(text).toContain('file.ts');
  });
});
