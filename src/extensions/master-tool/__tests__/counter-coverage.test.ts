import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CounterState, renderResult } from '../commands/demo/counter.js';
import { execute } from '../commands/demo/counter.js';
import { Text } from '@earendil-works/pi-tui';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Mutex } from '../utils/mutex.js';

describe('CounterState Unit', () => {
  let state: CounterState;
  let tmpDir: string;

  beforeEach(async () => {
    state = new CounterState();
    tmpDir = join('/tmp', `counter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup temp dir if exists
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe('increment', () => {
    it('increments by 1 and marks dirty', async () => {
      expect(state.count).toBe(0);
      expect(state.isDirty).toBe(false);

      const result = await state.increment();

      expect(result).toBe(1);
      expect(state.count).toBe(1);
      expect(state.isDirty).toBe(true);
    });

    it('increments by custom delta', async () => {
      const result = await state.increment(5);
      expect(result).toBe(5);
      expect(state.count).toBe(5);
    });

    it('is mutex-protected (serialized)', async () => {
      // Two increments concurrently should both execute, but state remains consistent
      const p1 = state.increment(1);
      const p2 = state.increment(2);
      const [r1, r2] = await Promise.all([p1, p2]);

      // Values could be 1,3 or 2,3 depending on order, but sum should be 3
      expect(state.count).toBe(3);
      expect(new Set([r1, r2]).size).toBe(2);
    });
  });

  describe('reset', () => {
    it('resets count to 0 and marks dirty', async () => {
      state.count = 10;
      expect(state.isDirty).toBe(false);

      await state.reset();

      expect(state.count).toBe(0);
      expect(state.isDirty).toBe(true);
    });

    it('is mutex-protected', async () => {
      state.count = 5;
      const p1 = state.reset();
      const p2 = state.increment(2);
      await Promise.all([p1, p2]);

      expect(state.count).toBe(2);
    });
  });

  describe('getSnapshot', () => {
    it('returns current count', () => {
      state.count = 42;
      expect(state.getSnapshot()).toEqual({ count: 42 });
    });
  });

  describe('getPersistencePath', () => {
    it('returns correct path', () => {
      const ctx = { cwd: '/home/user' } as any;
      const path = CounterState.getPersistencePath(ctx, 'demo.counter');
      expect(path).toBe(join('/home/user', '.piclaw', 'demo', 'demo.counter.json'));
    });
  });

  describe('load', () => {
    it('loads from file if exists', async () => {
      const file = join(tmpDir, '.piclaw', 'demo', 'demo.counter.json');
      await fs.mkdir(join(tmpDir, '.piclaw', 'demo'), { recursive: true });
      await fs.writeFile(file, JSON.stringify({ count: 15 }));

      const loaded = await state.load({ cwd: tmpDir } as any);

      expect(loaded).toBe(true);
      expect(state.count).toBe(15);
      expect(state.isDirty).toBe(false);
    });

    it('returns false and sets count=0 if file not found', async () => {
      const loaded = await state.load({ cwd: tmpDir } as any);

      expect(loaded).toBe(false);
      expect(state.count).toBe(0);
      expect(state.isDirty).toBe(false);
    });

    it('returns false on parse error', async () => {
      const file = join(tmpDir, 'counter.json');
      await fs.writeFile(file, 'invalid json');

      const loaded = await state.load({ cwd: tmpDir } as any);

      expect(loaded).toBe(false);
      expect(state.count).toBe(0);
      expect(state.isDirty).toBe(false);
    });
  });

  describe('save', () => {
    beforeEach(async () => {
      state.count = 7;
      state.markDirty();
    });

    it('does nothing if not dirty', async () => {
      state.markClean();
      await state.save({ cwd: tmpDir } as any);
      // No file should be created
      const file = join(tmpDir, '.piclaw', 'demo', 'demo.counter.json');
      try {
        await fs.access(file);
        throw new Error('File should not exist');
      } catch (e: any) {
        if (e.code !== 'ENOENT') throw e;
      }
    });

    it('saves to file atomically if dirty', async () => {
      await state.save({ cwd: tmpDir } as any);
      const file = join(tmpDir, '.piclaw', 'demo', 'demo.counter.json');
      const content = await fs.readFile(file, 'utf-8');
      expect(JSON.parse(content)).toEqual({ count: 7 });
      expect(state.isDirty).toBe(false);
    });

    it('creates directory if not exists', async () => {
      // Do not pre-create dir
      await state.save({ cwd: tmpDir } as any);
      const file = join(tmpDir, '.piclaw', 'demo', 'demo.counter.json');
      const content = await fs.readFile(file, 'utf-8');
      expect(JSON.parse(content)).toEqual({ count: 7 });
    });

    it('handles write error gracefully (mutex still released)', async () => {
      // Mock fs.writeFile to throw
      const origWriteFile = fs.writeFile;
      fs.writeFile = vi.fn().mockRejectedValue(new Error('disk full'));

      try {
        await expect(state.save({ cwd: tmpDir } as any)).rejects.toThrow('disk full');
        // Mutex should be released (no deadlock)
        // Subsequent operations should work
        await state.increment();
        expect(state.count).toBe(8);
      } finally {
        fs.writeFile = origWriteFile;
      }
    });

    it('propagates mkdir error', async () => {
      const origMkdir = fs.mkdir;
      fs.mkdir = vi.fn().mockRejectedValue(new Error('EACCES'));

      try {
        await expect(state.save({ cwd: tmpDir } as any)).rejects.toThrow('EACCES');
      } finally {
        fs.mkdir = origMkdir;
      }
    });

    it('propagates rename error', async () => {
      // mkdir succeeds
      const origRename = fs.rename;
      fs.rename = vi.fn().mockRejectedValue(new Error('EXDEV'));

      try {
        await expect(state.save({ cwd: tmpDir } as any)).rejects.toThrow('EXDEV');
      } finally {
        fs.rename = origRename;
      }
    });
  });
});

describe('Counter Command Execute', () => {
  let ctx: any;
  let state: CounterState;
  const cwd = '/tmp';

  beforeEach(async () => {
    state = new CounterState();
    await state.load({ cwd } as any); // starts with 0
    ctx = {
      cwd,
      commandState: state,
      // Minimal other context properties if needed
    } as any;
  });

  describe('execute', () => {
    it('inc: increments and returns result', async () => {
      const result = await execute({ action: 'inc' }, cwd, undefined, ctx);

      expect(result.code).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.data).toEqual({ action: 'inc', value: 1, delta: 1 });
      expect(result.stdout).toContain('1');
    });

    it('inc: respects delta', async () => {
      const result = await execute({ action: 'inc', delta: 5 }, cwd, undefined, ctx);

      expect(result.data.value).toBe(5); // fresh state count=0 -> +5
      expect(result.data.delta).toBe(5);
    });

    it('get: returns current count', async () => {
      state.count = 42; // set directly
      const result = await execute({ action: 'get' }, cwd, undefined, ctx);

      expect(result.code).toBe(0);
      expect(result.data).toEqual({ action: 'get', value: 42 });
    });

    it('reset: sets count to 0', async () => {
      state.count = 10;
      const result = await execute({ action: 'reset' }, cwd, undefined, ctx);

      expect(result.code).toBe(0);
      expect(state.count).toBe(0);
      expect(result.data).toEqual({ action: 'reset', value: 0 });
    });

    it('unknown action: returns error', async () => {
      const result = await execute({ action: 'foo' } as any, cwd, undefined, ctx);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Unknown action');
    });

    it('signal aborted: returns cancelled error', async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await execute({ action: 'inc' }, cwd, controller.signal, ctx);

      expect(result.code).toBe(1);
      expect(result.data?.error).toBe('cancelled');
    });

    it('missing state: returns state_missing error', async () => {
      const result = await execute({ action: 'inc' }, cwd, undefined, {} as any);

      expect(result.code).toBe(1);
      expect(result.data?.error).toBe('state_missing');
    });

    it('throws inside try-catch: returns error result', async () => {
      // Mock state.increment to throw
      const badState = { increment: () => { throw new Error('boom'); } } as any;
      const badCtx = { ...ctx, commandState: badState };
      const result = await execute({ action: 'inc' }, cwd, undefined, badCtx);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Error: boom');
      expect(result.data?.error).toBe('boom');
    });
  });
});

describe('Counter RenderResult', () => {
  const fakeTheme = {
    fg: (name: string, s: string) => s
  } as any;
  const options = {} as any;

  it('renders error when code != 0', () => {
    const result = { code: 1, stderr: 'Oops', stdout: '' };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });

  it('renders plain stdout when no data', () => {
    const result = { code: 0, stdout: 'Hello', stderr: '' };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });

  it('renders inc action', () => {
    const result = { code: 0, stdout: '', stderr: '', data: { action: 'inc', value: 5, delta: 2 } };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });

  it('renders get action', () => {
    const result = { code: 0, stdout: '', stderr: '', data: { action: 'get', value: 10 } };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });

  it('renders reset action', () => {
    const result = { code: 0, stdout: '', stderr: '', data: { action: 'reset', value: 0 } };
    const rendered = renderResult(result, options, fakeTheme);
    expect(rendered).toBeInstanceOf(Text);
  });
});
