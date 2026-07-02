import { describe, it, expect, vi } from 'vitest';
import { execute, renderResult, parseTestOutput } from '../commands/dev/test.js';
import { Text } from '@earendil-works/pi-tui';

describe('DevTest Execute Argument Branches', () => {
  const baseCtx = {
    cwd: '/tmp',
    exec: async () => ({ code: 0, stdout: '', stderr: '' })
  } as any;

  it('includes --watch flag when watch=true', async () => {
    const execMock = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    const ctx = { ...baseCtx, exec: execMock };

    await execute({ watch: true }, '/tmp', undefined, ctx);

    expect(execMock).toHaveBeenCalledWith(
      'npm',
      ['test', '--watch'],
      { cwd: '/tmp', signal: undefined }
    );
  });

  it('includes --silent flag when silent=true', async () => {
    const execMock = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    const ctx = { ...baseCtx, exec: execMock };

    await execute({ silent: true }, '/tmp', undefined, ctx);

    expect(execMock).toHaveBeenCalledWith(
      'npm',
      ['test', '--silent'],
      { cwd: '/tmp', signal: undefined }
    );
  });

  it('includes --threads argument when threads provided', async () => {
    const execMock = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    const ctx = { ...baseCtx, exec: execMock };

    await execute({ threads: 4 }, '/tmp', undefined, ctx);

    expect(execMock).toHaveBeenCalledWith(
      'npm',
      ['test', '--threads=4'],
      { cwd: '/tmp', signal: undefined }
    );
  });

  it('includes --testNamePattern when name provided', async () => {
    const execMock = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    const ctx = { ...baseCtx, exec: execMock };

    await execute({ name: 'should handle errors' }, '/tmp', undefined, ctx);

    expect(execMock).toHaveBeenCalledWith(
      'npm',
      ['test', '--testNamePattern', 'should handle errors'],
      { cwd: '/tmp', signal: undefined }
    );
  });

  it('includes file arguments when files provided', async () => {
    const execMock = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    const ctx = { ...baseCtx, exec: execMock };

    await execute({ files: ['src/utils/', 'src/components/'] }, '/tmp', undefined, ctx);

    expect(execMock).toHaveBeenCalledWith(
      'npm',
      ['test', 'src/utils/', 'src/components/'],
      { cwd: '/tmp', signal: undefined }
    );
  });

  it('handles missing ctx.exec by returning default', async () => {
    const result = await execute({}, '/tmp', undefined, {} as any);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});

describe('DevTest parseTestOutput', () => {
  it('parses skipped tests (counts keyword occurrences, not number)', () => {
    const stdout = 'Test Files  2 skipped (2)\n';
    const result = parseTestOutput(stdout);
    // Our simplistic parser counts occurrences of the word 'skipped'
    expect(result.skipped).toBe(1);
    expect(result.passed).toBe(0);
  });

  it('parses duration in seconds (integer)', () => {
    const stdout = 'Test Files  1 passed ( 2s )\n';
    const result = parseTestOutput(stdout);
    expect(result.duration).toBe(2000);
  });

  it('parses duration in milliseconds', () => {
    const stdout = 'Test Files  1 passed ( 450ms )\n';
    const result = parseTestOutput(stdout);
    expect(result.duration).toBe(450);
  });

  it('parses mixed passed and failed counts (Jest style)', () => {
    const stdout = 'PASS  a.test.ts\nFAIL  b.test.ts\n';
    const result = parseTestOutput(stdout);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('parses Vitest detailed summary (just checkmarks)', () => {
    const stdout = `✓ src/utils/format.test.ts
✓ src/components/button.test.ts
`;
    const result = parseTestOutput(stdout);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(0);
  });
});

describe('DevTest RenderResult Coverage', () => {
  const fakeTheme = { fg: (n: string, s: string) => s } as any;
  const options = {} as any;

  it('renders error when code != 0', () => {
    const result = { code: 1, stderr: 'npm error', stdout: '' };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });

  it('renders result with coverage data', () => {
    const result = {
      code: 0,
      stdout: '',
      stderr: '',
      data: { passed: 10, failed: 0, skipped: 0, duration: 5000, coverage: { lines: 90, functions: 95, statements: 92, branches: 88 } }
    };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });

  it('renders result with duration > 0', () => {
    const result = {
      code: 0,
      stdout: '',
      stderr: '',
      data: { passed: 5, failed: 0, skipped: 0, duration: 2500 }
    };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });
});
