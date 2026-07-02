import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRegistry } from '../command-registry.js';

vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn()
}));
import { readdir, stat } from 'fs/promises';

describe('CommandRegistry - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readdir.mockResolvedValue([]);
    stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any);
  });

  it('initialize without customCommands', async () => {
    const r = new CommandRegistry({ commandsDir: '/fake' });
    await r.initialize();
    expect(r.listCommands()).toEqual([]);
  });

  it('ensureInitialized returns quickly when already initialized', async () => {
    const r = new CommandRegistry({ commandsDir: '/fake' });
    await r.initialize();
    // Second call should hit the early return
    await r.ensureInitialized();
    expect(readdir).toHaveBeenCalledTimes(1);
  });

  it('execute returns error when loader throws', async () => {
    const badLoader = async () => { throw new Error('loader fail'); };
    const custom = new Map([['bad', badLoader]]);
    const r = new CommandRegistry({}, custom);
    await r.initialize();

    const result = await r.execute('bad', {}, {
      toolCallId: '1',
      signal: new AbortController().signal,
      onUpdate: vi.fn(),
      ctx: {},
      maxOutputSize: 1024
    });

    expect(result.isError).toBe(true);
    // Error message should contain the loader error
    const text = result.content.map(c => c.text).join(' ');
    expect(text).toContain('loader fail');
  });
});
