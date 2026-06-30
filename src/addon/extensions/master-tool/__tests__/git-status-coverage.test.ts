import { describe, it, expect, vi } from 'vitest';
import { execute, renderResult } from '../commands/git/status.js';
import { Text } from '@earendil-works/pi-tui';

describe('GitStatus Execute Edge Cases', () => {
  const baseCtx = {
    cwd: '/tmp',
    exec: async () => ({ code: 0, stdout: '', stderr: '' })
  } as any;

  it('handles exec rejection (catch block)', async () => {
    const brokenExec = vi.fn().mockRejectedValue(new Error('git not found'));
    const ctx = { ...baseCtx, exec: brokenExec };

    const result = await execute({}, '/tmp', undefined, ctx);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('git not found');
  });

  it('includes unstaged files in output', async () => {
    // Porcelain line for unstaged: starts with space then code (e.g., ' M file')
    const output = `## main\n M file1.ts\nA  staged.ts\n?? new.txt`;
    const ctx = {
      ...baseCtx,
      exec: vi.fn().mockResolvedValue({ code: 0, stdout: output, stderr: '' })
    };

    const result = await execute({}, '/tmp', undefined, ctx);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Unstaged: 1');
    expect((result.data as any).unstaged).toContain(' M file1.ts');
    expect((result.data as any).unstaged).toHaveLength(1);
  });

  it('handles no branch line (unknown branch)', async () => {
    const output = `M  file.ts\n?? untracked.txt`;
    const ctx = {
      ...baseCtx,
      exec: vi.fn().mockResolvedValue({ code: 0, stdout: output, stderr: '' })
    };

    const result = await execute({}, '/tmp', undefined, ctx);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Branch: (unknown)');
    expect((result.data as any).branch).toBe('(unknown)');
  });
});

describe('GitStatus RenderResult Coverage', () => {
  const fakeTheme = {
    fg: (name: string, s: string) => s
  } as any;
  const options = {} as any;

  it('renders error when code != 0', () => {
    const result = { code: 1, stderr: 'fatal: error', stdout: '' };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });

  it('renders plain stdout when data missing', () => {
    const result = { code: 0, stdout: 'Some output', stderr: '' };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });

  it('renders with staged files only', () => {
    const result = {
      code: 0,
      stdout: '',
      stderr: '',
      data: { branch: 'main', staged: ['M  a.ts'], unstaged: [], untracked: [], totalFiles: 1 }
    };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });

  it('renders with unstaged files only', () => {
    const result = {
      code: 0,
      stdout: '',
      stderr: '',
      data: { branch: 'main', staged: [], unstaged: [' M b.ts'], untracked: [], totalFiles: 1 }
    };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });

  it('renders with untracked files only', () => {
    const result = {
      code: 0,
      stdout: '',
      stderr: '',
      data: { branch: 'main', staged: [], unstaged: [], untracked: ['new.ts'], totalFiles: 1 }
    };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });

  it('renders clean working tree (totalFiles=0)', () => {
    const result = {
      code: 0,
      stdout: '',
      stderr: '',
      data: { branch: 'main', staged: [], unstaged: [], untracked: [], totalFiles: 0 }
    };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });
});
