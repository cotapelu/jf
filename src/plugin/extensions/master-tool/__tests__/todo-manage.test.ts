#!/usr/bin/env node
/**
 * Todo Manage Command - Comprehensive Unit Tests
 *
 * Tests all branches of execute() and renderResult()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rmdir, unlink } from 'node:fs/promises';
import os from 'node:os';
import { Text } from '@earendil-works/pi-tui';
import {
  execute,
  renderResult,
  TodoState
} from '../commands/todo/manage.js';

// Mock theme for renderResult
function createMockTheme() {
  return {
    fg: (color: string, text: string) => text,
    bg: () => '',
    bold: () => '',
    dim: () => '',
    underline: () => '',
    inverse: () => '',
    hex: () => ''
  };
}

describe('Todo Manage Command - execute()', () => {
  let tempDir: string;
  let baseCtx: any;
  let mockState: TodoState;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(os.tmpdir(), 'piclaw-todo-'));
    mockState = new TodoState();
    baseCtx = {
      cwd: tempDir,
      exec: async () => ({ code: 0, stdout: '', stderr: '' }),
      commandState: mockState
    };
  });

  afterEach(async () => {
    try {
      const stateFile = join(tempDir, '.piclaw', 'commands', 'todo.manage.json');
      await unlink(stateFile).catch(() => {});
      await rmdir(join(tempDir, '.piclaw', 'commands'), { recursive: true }).catch(() => {});
      await rmdir(join(tempDir, '.piclaw'), { recursive: true }).catch(() => {});
      await rmdir(tempDir, { recursive: true }).catch(() => {});
    } catch (e) {}
  });

  const makeCtx = (signal?: AbortSignal) => {
    const ctx: any = { ...baseCtx };
    if (signal) ctx.signal = signal;
    return ctx;
  };

  describe('state initialization', () => {
    it('should return error if state is missing', async () => {
      const ctxNoState = { cwd: tempDir, exec: baseCtx.exec }; // no commandState
      const result = await execute({ action: 'list' }, tempDir, undefined, ctxNoState);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('State not initialized');
    });
  });

  describe('add action', () => {
    it('should add task with content', async () => {
      const result = await execute({ action: 'add', content: 'Test task' }, tempDir, undefined, makeCtx());
      expect(result.code).toBe(0);
      expect(result.data).toMatchObject({ action: 'add' });
      expect(result.data.item.content).toBe('Test task');
      expect(mockState.tasks.length).toBe(1);
    });

    it('should return error if content missing', async () => {
      const result = await execute({ action: 'add' }, tempDir, undefined, makeCtx());
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('content required');
      expect(mockState.tasks.length).toBe(0);
    });

    it('should increment IDs sequentially', async () => {
      await execute({ action: 'add', content: 'Task 1' }, tempDir, undefined, makeCtx());
      await execute({ action: 'add', content: 'Task 2' }, tempDir, undefined, makeCtx());
      await execute({ action: 'add', content: 'Task 3' }, tempDir, undefined, makeCtx());
      expect(mockState.tasks.map(t => t.content)).toEqual(['Task 1', 'Task 2', 'Task 3']);
      expect(mockState.tasks.map(t => t.id)).toEqual([1, 2, 3]);
    });
  });

  describe('list action', () => {
    it('should show empty message when no tasks', async () => {
      const result = await execute({ action: 'list' }, tempDir, undefined, makeCtx());
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('No tasks');
    });

    it('should list all tasks with stats', async () => {
      // Use a fresh state
      const newState = new TodoState();
      const ctxWithNewState = { ...baseCtx, commandState: newState };
      // Add tasks using execute to ensure proper async handling
      await execute({ action: 'add', content: 'Task 1' }, tempDir, undefined, ctxWithNewState);
      await execute({ action: 'add', content: 'Task 2' }, tempDir, undefined, ctxWithNewState);
      await execute({ action: 'toggle', id: 1 }, tempDir, undefined, ctxWithNewState);

      const result = await execute({ action: 'list' }, tempDir, undefined, ctxWithNewState);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Total: 2');
      expect(result.stdout).toContain('1 done');
      expect(result.stdout).toContain('1 pending');
      expect(result.stdout).toContain('Task 1');
      expect(result.stdout).toContain('Task 2');
    });
  });

  describe('toggle action', () => {
    it('should toggle task completion', async () => {
      const addResult = await execute({ action: 'add', content: 'Test' }, tempDir, undefined, makeCtx());
      const taskId = addResult.data.item.id;

      let result = await execute({ action: 'toggle', id: taskId }, tempDir, undefined, makeCtx());
      expect(result.code).toBe(0);
      expect(result.data.done).toBe(true);

      result = await execute({ action: 'toggle', id: taskId }, tempDir, undefined, makeCtx());
      expect(result.code).toBe(0);
      expect(result.data.done).toBe(false);
    });

    it('should return not found for non-existent id', async () => {
      const result = await execute({ action: 'toggle', id: 999 }, tempDir, undefined, makeCtx());
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('not found');
    });

    it('should require id parameter', async () => {
      const result = await execute({ action: 'toggle' }, tempDir, undefined, makeCtx());
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('id required');
    });
  });

  describe('remove action', () => {
    it('should remove existing task', async () => {
      const addResult = await execute({ action: 'add', content: 'To remove' }, tempDir, undefined, makeCtx());
      const taskId = addResult.data.item.id;
      expect(mockState.tasks.length).toBe(1);

      const result = await execute({ action: 'remove', id: taskId }, tempDir, undefined, makeCtx());
      expect(result.code).toBe(0);
      expect(mockState.tasks.length).toBe(0);
    });

    it('should return not found for non-existent id', async () => {
      const result = await execute({ action: 'remove', id: 999 }, tempDir, undefined, makeCtx());
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('not found');
    });

    it('should require id parameter', async () => {
      const result = await execute({ action: 'remove' }, tempDir, undefined, makeCtx());
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('id required');
    });
  });

  describe('unknown action', () => {
    it('should return error for unknown action', async () => {
      const result = await execute({ action: 'unknown' as any }, tempDir, undefined, makeCtx());
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Unknown action');
    });
  });

  describe('signal abort', () => {
    it('should respect aborted signal', async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await execute({ action: 'list' }, tempDir, controller.signal, makeCtx(controller.signal));
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('cancelled');
    });
  });

  describe('error handling', () => {
    it('should catch and return errors from state operations', async () => {
      const brokenState = {
        add: async () => { throw new Error('DB failure'); },
        tasks: [],
        isDirty: false,
        markDirty: () => {},
        markClean: () => {},
        subscribe: () => () => {},
        getSnapshot: () => ({ tasks: [], nextId: 1 })
      } as any;

      const ctxBroken = { ...baseCtx, commandState: brokenState };

      const result = await execute(
        { action: 'add', content: 'Test' },
        tempDir,
        undefined,
        ctxBroken
      );

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Error: DB failure');
    });
  });
});

describe('Todo Manage Command - renderResult()', () => {
  const mockTheme = createMockTheme();

  // renderResult expects raw execute result shape: { code, stdout, stderr, data }
  const render = (raw: any) => renderResult(raw, {}, mockTheme);

  describe('error branch', () => {
    it('should render stderr for non-zero code', () => {
      const raw = { code: 1, stdout: '', stderr: 'Something broke', data: { error: 'fail' } };
      const result = render(raw);
      expect(result instanceof Text).toBe(true);
      expect(result.text).toContain('❌');
      expect(result.text).toContain('Something broke');
    });
  });

  describe('successful actions', () => {
    it('should render add result', () => {
      const raw = { code: 0, stdout: '', stderr: '', data: { action: 'add', item: { id: 5, content: 'Buy milk' } } };
      const result = render(raw);
      expect(result instanceof Text).toBe(true);
      expect(result.text).toContain('Added todo');
      expect(result.text).toContain('#5');
      expect(result.text).toContain('Buy milk');
    });

    it('should render list with tasks', () => {
      const tasks = [
        { id: 1, content: 'Task A', done: false },
        { id: 2, content: 'Task B', done: true }
      ];
      const raw = { code: 0, stdout: '', stderr: '', data: { action: 'list', tasks, stats: { total: 2, done: 1, pending: 1 } } };
      const result = render(raw);
      expect(result.text).toContain('Total: 2');
      expect(result.text).toContain('1 done');
      expect(result.text).toContain('1 pending');
      expect(result.text).toContain('Task A');
      expect(result.text).toContain('Task B');
    });

    it('should render list with ellipsis when >10 tasks', () => {
      const tasks = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, content: `Task ${i + 1}`, done: false }));
      const raw = { code: 0, stdout: '', stderr: '', data: { action: 'list', tasks, stats: { total: 15, done: 0, pending: 15 } } };
      const result = render(raw);
      expect(result.text).toContain('... and 5 more');
    });

    it('should render toggle result', () => {
      const raw = { code: 0, stdout: '', stderr: '', data: { action: 'toggle', id: 3, done: true } };
      const result = render(raw);
      expect(result.text).toContain('Toggled task #3');
      expect(result.text).toContain('DONE');
    });

    it('should render remove result', () => {
      const raw = { code: 0, stdout: '', stderr: '', data: { action: 'remove', id: 5 } };
      const result = render(raw);
      expect(result.text).toContain('Removed task #5');
    });
  });

  describe('stdout fallback', () => {
    it('should render stdout when data is undefined', () => {
      const raw = { code: 0, stdout: 'Plain output line', stderr: '', data: undefined };
      const result = render(raw);
      expect(result.text).toBe('Plain output line');
    });
  });
});
