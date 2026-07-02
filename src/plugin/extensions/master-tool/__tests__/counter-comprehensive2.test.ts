import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CounterState } from '../commands/demo/counter.js';
import { execute as counterExecute } from '../commands/demo/counter.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import os from 'os';

describe('CounterState', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'piclaw-counter-state-'));
  });
  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('increment increases count', async () => {
    const state = new CounterState();
    expect(state.count).toBe(0);
    await state.increment();
    expect(state.count).toBe(1);
    await state.increment(3);
    expect(state.count).toBe(4);
  });

  it('reset sets count to 0', async () => {
    const state = new CounterState();
    state.count = 5;
    await state.reset();
    expect(state.count).toBe(0);
  });

  it('getSnapshot returns current count', () => {
    const state = new CounterState();
    state.count = 7;
    expect(state.getSnapshot()).toEqual({ count: 7 });
  });

  it('load from file succeeds', async () => {
    const filePath = CounterState.getPersistencePath({ cwd: tempDir } as any, 'demo.counter');
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ count: 10 }), 'utf-8');
    const state = new CounterState();
    const ok = await state.load({ cwd: tempDir } as any);
    expect(ok).toBe(true);
    expect(state.count).toBe(10);
    expect(state.isDirty).toBe(false);
  });

  it('load handles missing file', async () => {
    const state = new CounterState();
    const ok = await state.load({ cwd: tempDir } as any);
    expect(ok).toBe(false);
    expect(state.count).toBe(0);
  });

  it('save writes file', async () => {
    const filePath = CounterState.getPersistencePath({ cwd: tempDir } as any, 'demo.counter');
    const state = new CounterState();
    state.count = 15;
    state.isDirty = true; // mark dirty to trigger save
    await state.save({ cwd: tempDir } as any);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(JSON.parse(content)).toEqual({ count: 15 });
  });
});

describe('counter.execute', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'piclaw-counter-exec-'));
  });
  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const makeCtx = (state: CounterState) => ({
    cwd: tempDir,
    commandState: state,
    cwd: tempDir
  } as any);

  it('get action returns current count', async () => {
    const state = new CounterState();
    state.count = 3;
    const result = await counterExecute({ action: 'get' }, tempDir, undefined, makeCtx(state));
    expect(result.code).toBe(0);
    expect(result.data.value).toBe(3);
  });

  it('inc action increments', async () => {
    const state = new CounterState();
    const result = await counterExecute({ action: 'inc' }, tempDir, undefined, makeCtx(state));
    expect(result.code).toBe(0);
    expect(result.data.value).toBe(1);
  });

  it('inc with delta', async () => {
    const state = new CounterState();
    const result = await counterExecute({ action: 'inc', delta: 5 }, tempDir, undefined, makeCtx(state));
    expect(result.code).toBe(0);
    expect(result.data.value).toBe(5);
  });

  it('reset action', async () => {
    const state = new CounterState();
    state.count = 7;
    const result = await counterExecute({ action: 'reset' }, tempDir, undefined, makeCtx(state));
    expect(result.code).toBe(0);
    expect(result.data.value).toBe(0);
  });

  it('returns error for unknown action', async () => {
    const state = new CounterState();
    const result = await counterExecute({ action: 'foo' } as any, tempDir, undefined, makeCtx(state));
    expect(result.code).toBe(1);
    expect(result.data.error).toBe('unknown_action');
  });
});

describe('counter.renderResult', () => {
  const fakeTheme = { fg: (style: string, text: string) => text };
  let renderResult: any;
  beforeAll(async () => {
    const mod = await import('../commands/demo/counter.js');
    renderResult = mod.renderResult;
  });

  it('renders get result', () => {
    const result = { code: 0, stdout: '', stderr: '', data: { action: 'get', value: 42 } };
    const res = renderResult(result, {}, fakeTheme);
    expect(res).toBeDefined();
  });

  it('renders inc result', () => {
    const result = { code: 0, stdout: '', stderr: '', data: { action: 'inc', value: 5, delta: 2 } };
    const res = renderResult(result, {}, fakeTheme);
    expect(res).toBeDefined();
  });

  it('renders reset result', () => {
    const result = { code: 0, stdout: '', stderr: '', data: { action: 'reset', value: 0 } };
    const res = renderResult(result, {}, fakeTheme);
    expect(res).toBeDefined();
  });

  it('renders error', () => {
    const result = { code: 1, stdout: '', stderr: 'Something broke', data: undefined };
    const res = renderResult(result, {}, fakeTheme);
    expect(res).toBeDefined();
  });
});
