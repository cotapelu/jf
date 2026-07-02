import { describe, it, expect } from 'vitest';
import { renderResult } from '../renderers/status-renderer';
import { Text } from '@earendil-works/pi-tui';

// Simple mock theme: fg returns text unchanged
const theme: any = {
  fg: (_color: string, text: string) => text,
  bold: () => ({})
};

describe('status-renderer', () => {
  it('renders successful status with changes', () => {
    const result = {
      isError: false,
      details: {
        branch: 'main',
        staged: ['file1.ts'],
        unstaged: ['file2.ts'],
        untracked: ['file3.ts']
      }
    };
    const component = renderResult(result, {}, theme);
    expect(component).toBeInstanceOf(Text);
    // Check that component text includes branch and file names
    // The Text class typically stores the text in .text or .content; depending on implementation, we can check via string cast
    const output = (component as any).text || (component as any).content;
    expect(output).toContain('main');
    expect(output).toContain('file1.ts');
    expect(output).toContain('file2.ts');
    expect(output).toContain('file3.ts');
  });

  it('renders empty status (no changes)', () => {
    const result = {
      isError: false,
      details: {
        branch: 'feature',
        staged: [],
        unstaged: [],
        untracked: []
      }
    };
    const component = renderResult(result, {}, theme);
    expect(component).toBeInstanceOf(Text);
  });

  it('renders error', () => {
    const result = {
      isError: true,
      details: { error: 'git error' }
    };
    const component = renderResult(result, {}, theme);
    expect(component).toBeInstanceOf(Text);
    const output = (component as any).text || (component as any).content;
    expect(output).toContain('git error');
  });
});
