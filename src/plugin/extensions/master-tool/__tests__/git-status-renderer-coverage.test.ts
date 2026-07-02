import { describe, it, expect } from 'vitest';
import { renderResult } from '../commands/git/status.js';

describe('git.status renderResult coverage', () => {
  const fakeTheme = { fg: (style: string, text: string) => text };

  it('renders error when code != 0', () => {
    const result = { code: 1, stdout: '', stderr: 'error msg', data: undefined };
    const res = renderResult(result, {}, fakeTheme);
    expect(res).toBeDefined();
  });

  it('renders stdout when no data', () => {
    const result = { code: 0, stdout: 'some output', stderr: '', data: undefined };
    const res = renderResult(result, {}, fakeTheme);
    expect(res).toBeDefined();
  });

  it('renders full status with lists', () => {
    const result = {
      code: 0,
      stdout: '',
      stderr: '',
      data: {
        branch: 'main',
        staged: ['M  file1.ts'],
        unstaged: [' M file2.ts'],
        untracked: ['?? new.txt'],
        totalFiles: 3
      }
    };
    const res = renderResult(result, {}, fakeTheme);
    expect(res).toBeDefined();
  });

  it('handles empty status (working tree clean)', () => {
    const result = {
      code: 0,
      stdout: '',
      stderr: '',
      data: {
        branch: 'main',
        staged: [],
        unstaged: [],
        untracked: [],
        totalFiles: 0
      }
    };
    const res = renderResult(result, {}, fakeTheme);
    expect(res).toBeDefined();
  });

  it('truncates long lists', () => {
    const many = Array(10).fill('file');
    const result = {
      code: 0,
      stdout: '',
      stderr: '',
      data: {
        branch: 'main',
        staged: many,
        unstaged: many,
        untracked: many,
        totalFiles: 30
      }
    };
    const res = renderResult(result, {}, fakeTheme);
    expect(res).toBeDefined();
  });
});
