/**
 * GitExtension Tests
 */

import { describe, it, expect } from 'vitest';
import { GitExtension } from '../../tools/extensions/git/git-extension.js';

describe('GitExtension', () => {
  it('should have correct name and version', () => {
    const ext = new GitExtension();
    expect(ext.name).toBe('git');
    expect(ext.version).toBe('1.0.0');
    expect(ext.description).toBe('Git version control operations');
  });

  it('should return 5 tools', () => {
    const ext = new GitExtension();
    const tools = ext.getTools('/cwd');
    expect(tools).toHaveLength(5);
  });

  it('should include all required git tool names', () => {
    const ext = new GitExtension();
    const tools = ext.getTools('/cwd');
    const names = tools.map((t: any) => t.name).sort();
    expect(names).toEqual([
      'git.commit',
      'git.diff',
      'git.pull',
      'git.push',
      'git.status',
    ]);
  });

  it('should provide valid ToolDefinitions', () => {
    const ext = new GitExtension();
    const tools = ext.getTools('/cwd');
    for (const tool of tools) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('label');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('parameters');
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('should accept custom options', () => {
    const ext = new GitExtension({ defaultAuthor: 'Test <test@example.com>' });
    expect(ext['options'].defaultAuthor).toBe('Test <test@example.com>');
  });
});
