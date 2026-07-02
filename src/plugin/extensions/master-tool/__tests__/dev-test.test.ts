#!/usr/bin/env node
/**
 * Dev Test Command - Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rmdir } from 'node:fs/promises';
import os from 'node:os';
import { Text } from '@earendil-works/pi-tui';
import { execute, renderResult } from '../commands/dev/test.js';

function createMockTheme() {
  return { fg: (c: string, t: string) => t, bold: () => '', dim: () => '' };
}

describe('Dev Test Command - execute()', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(os.tmpdir(), 'piclaw-devtest-'));
  });

  afterEach(async () => {
    try { await rmdir(tempDir, { recursive: true }).catch(() => {}); } catch (e) {}
  });

  const makeExec = (result: any) => vi.fn().mockResolvedValue(result);

  it('builds basic npm test command', async () => {
    const execFn = makeExec({ code: 0, stdout: '', stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    await execute({}, tempDir, undefined, ctx);
    expect(execFn).toHaveBeenCalledWith('npm', ['test'], { cwd: tempDir, signal: undefined });
  });

  it('adds --coverage when coverage=true', async () => {
    const execFn = makeExec({ code: 0, stdout: '', stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    await execute({ coverage: true }, tempDir, undefined, ctx);
    const args = execFn.mock.calls[0][1];
    expect(args).toContain('--coverage');
  });

  it('adds --watch when watch=true', async () => {
    const execFn = makeExec({ code: 0, stdout: '', stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    await execute({ watch: true }, tempDir, undefined, ctx);
    const args = execFn.mock.calls[0][1];
    expect(args).toContain('--watch');
  });

  it('adds --silent when silent=true', async () => {
    const execFn = makeExec({ code: 0, stdout: '', stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    await execute({ silent: true }, tempDir, undefined, ctx);
    const args = execFn.mock.calls[0][1];
    expect(args).toContain('--silent');
  });

  it('adds --threads=N when threads set', async () => {
    const execFn = makeExec({ code: 0, stdout: '', stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    await execute({ threads: 4 }, tempDir, undefined, ctx);
    const args = execFn.mock.calls[0][1];
    expect(args).toContain('--threads=4');
  });

  it('appends file patterns', async () => {
    const execFn = makeExec({ code: 0, stdout: '', stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    await execute({ files: ['src/a', 'src/b'] }, tempDir, undefined, ctx);
    const args = execFn.mock.calls[0][1];
    expect(args).toContain('src/a');
    expect(args).toContain('src/b');
  });

  it('adds --testNamePattern for name', async () => {
    const execFn = makeExec({ code: 0, stdout: '', stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    await execute({ name: 'my test' }, tempDir, undefined, ctx);
    const args = execFn.mock.calls[0][1];
    expect(args).toContain('--testNamePattern');
    expect(args).toContain('my test');
  });

  it('combines multiple flags', async () => {
    const execFn = makeExec({ code: 0, stdout: '', stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    await execute({
      coverage: true,
      watch: false,
      silent: true,
      threads: 2,
      files: ['src/'],
      name: 'pattern'
    }, tempDir, undefined, ctx);
    const args = execFn.mock.calls[0][1];
    expect(args).toContain('--coverage');
    expect(args).toContain('--silent');
    expect(args).toContain('--threads=2');
    expect(args).toContain('--testNamePattern');
    expect(args).toContain('src/');
  });

  it('parses stdout with checkmarks', async () => {
    const stdout = '✓ test1\n✓ test2\n✗ test3\n';
    const execFn = makeExec({ code: 1, stdout, stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    const result = await execute({}, tempDir, undefined, ctx);
    expect(result.data.passed).toBe(2); // two '✓'
    expect(result.data.failed).toBe(1); // one '✗'
  });

  it('parses stdout with PASS/FAIL words', async () => {
    const stdout = 'PASS a.test\nPASS b.test\nFAIL c.test\n';
    const execFn = makeExec({ code: 1, stdout, stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    const result = await execute({}, tempDir, undefined, ctx);
    expect(result.data.passed).toBe(2);
    expect(result.data.failed).toBe(1);
  });

  it('detects skipped tests via pending', async () => {
    const stdout = '✓ a\npending b\n✗ c\n';
    const execFn = makeExec({ code: 0, stdout, stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    const result = await execute({}, tempDir, undefined, ctx);
    expect(result.data.skipped).toBeGreaterThan(0);
  });

  it('returns zero stats for empty stdout', async () => {
    const execFn = makeExec({ code: 0, stdout: '', stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    const result = await execute({}, tempDir, undefined, ctx);
    expect(result.data.passed).toBe(0);
    expect(result.data.failed).toBe(0);
    expect(result.data.duration).toBe(0);
  });

  it('passes signal to exec options', async () => {
    const execFn = makeExec({ code: 0, stdout: '', stderr: '' });
    const ctx = { cwd: tempDir, exec: execFn } as any;
    const controller = new AbortController();
    controller.abort();
    await execute({}, tempDir, controller.signal, ctx);
    const options = execFn.mock.calls[0][2];
    expect(options.signal).toBe(controller.signal);
  });

  it('handles exec rejection', async () => {
    const execFn = makeExec({ code: 0, stdout: '', stderr: '' });
    execFn.mockRejectedValue(new Error('exec failed'));
    const ctx = { cwd: tempDir, exec: execFn } as any;
    const result = await execute({}, tempDir, undefined, ctx);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Test execution error');
  });

  it('handles missing exec gracefully', async () => {
    const ctx = { cwd: tempDir } as any; // no exec
    const result = await execute({}, tempDir, undefined, ctx);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.data).toBeDefined();
  });
});

describe('Dev Test Command - renderResult()', () => {
  const theme = createMockTheme();

  it('renders error', () => {
    const raw = { code: 1, stdout: '', stderr: 'Error details', data: undefined };
    const result = renderResult(raw, {}, theme);
    expect(result.text).toContain('Tests failed');
    expect(result.text).toContain('Error details');
  });

  it('renders success with stats', () => {
    const raw = {
      code: 0,
      stdout: '',
      stderr: '',
      data: { passed: 10, failed: 0, skipped: 2, duration: 1500 }
    };
    const result = renderResult(raw, {}, theme);
    expect(result.text).toContain('Test Results');
    expect(result.text).toContain('Passed: 10');
    expect(result.text).toContain('Failed: 0');
    expect(result.text).toContain('Skipped: 2');
    expect(result.text).toContain('Duration');
  });

  it('renders coverage when present', () => {
    const raw = {
      code: 0,
      stdout: '',
      stderr: '',
      data: { passed: 5, failed: 0, skipped: 0, duration: 1000, coverage: { lines: 85, functions: 90 } }
    };
    const result = renderResult(raw, {}, theme);
    expect(result.text).toContain('Coverage:');
    expect(result.text).toContain('Lines: 85%');
    expect(result.text).toContain('Functions: 90%');
  });

  it('calculates pass rate with one decimal', () => {
    const raw = {
      code: 0,
      stdout: '',
      stderr: '',
      data: { passed: 8, failed: 2, skipped: 0, duration: 500 }
    };
    const result = renderResult(raw, {}, theme);
    expect(result.text).toContain('Pass rate: 80.0%'); // toFixed(1) gives 80.0
  });

  describe('when data is undefined', () => {
    it('renders title only', () => {
      const raw = { code: 0, stdout: 'Plain output', stderr: '', data: undefined };
      const result = renderResult(raw, {}, theme);
      // Title uses .bold() which produces <b> tags
      expect(result.text).toContain('Test Results');
    });
  });
});
