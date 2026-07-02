import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TodoState } from '../extensions/tools/todos-tool.js';
import { mkdirSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Todos Load Edge Cases', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join('/tmp', `todos-load-test-${  Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('loadFromFile returns false when version is not 1', async () => {
    const state = new TodoState();
    const todosDir = join(tmpDir, '.piclaw', 'agent');
    mkdirSync(todosDir, { recursive: true });
    const filePath = join(todosDir, 'todos.json');
    writeFileSync(filePath, JSON.stringify({ version: 2, phases: [], nextTaskId: 1, nextPhaseId: 1 }));

    const loaded = await state.loadFromFile(tmpDir);
    expect(loaded).toBe(false);
    expect(state.getPhases()).toEqual([]);
  });

  it('loadFromFile returns false and logs error on parse failure', async () => {
    const state = new TodoState();
    const todosDir = join(tmpDir, '.piclaw', 'agent');
    mkdirSync(todosDir, { recursive: true });
    const filePath = join(todosDir, 'todos.json');
    writeFileSync(filePath, 'invalid json');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const loaded = await state.loadFromFile(tmpDir);
    expect(loaded).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Load todos failed:', expect.any(SyntaxError));

    consoleErrorSpy.mockRestore();
  });
});
