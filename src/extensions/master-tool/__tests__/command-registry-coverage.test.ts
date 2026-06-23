import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRegistry } from '../command-registry.js';

vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn()
}));
import { readdir, stat } from 'fs/promises';

describe('CommandRegistry - Coverage Gaps', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    readdir.mockResolvedValue([]);
    stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any);
    registry = new CommandRegistry({ commandsDir: '/fake/commands' });
  });

  describe('execute() unknown command branch', () => {
    it('should return command_not_found for unregistered command', async () => {
      const result = await registry.execute('unknown.cmd', {}, {
        toolCallId: '1',
        signal: new AbortController().signal,
        onUpdate: vi.fn(),
        ctx: {},
        maxOutputSize: 1024
      });

      expect(result.isError).toBe(true);
      // The error message includes 'Command not found'
      const text = result.content.map(c => c.text).join(' ');
      expect(text).toContain('Command not found');
    });
  });
});
