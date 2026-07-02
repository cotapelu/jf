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

  describe('initialize() concurrency guard', () => {
    it('should avoid duplicate scan when called during initialization', async () => {
      // Delay the first scan indefinitely
      let resolveScan: (value: void) => null;
      const scanPending = new Promise<void>((resolve) => { resolveScan = resolve; });
      readdir.mockImplementation(async () => {
        await scanPending;
        return [];
      });

      const r = new CommandRegistry({ commandsDir: '/fake' });

      // Start first init
      const p1 = r.initialize();
      // Allow microtask to set initPromise
      await Promise.resolve();

      // Second call during init
      const p2 = r.initialize();

      // readdir should have been called exactly once (first init only)
      expect(readdir).toHaveBeenCalledTimes(1);

      // Complete initialization
      resolveScan();
      await p1;
      await p2;
    });
  });
});
