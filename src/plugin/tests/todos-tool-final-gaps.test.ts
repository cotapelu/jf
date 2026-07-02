import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync as realRmSync, mkdirSync as realMkdirSync, existsSync as realExistsSync, promises } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  TodoState,
  applyOp,
  formatSummary,
  getLatestTodoPhasesFromEntries,
  registerTodosTool,
  TodoPhase,
} from '../extensions/tools/todos-tool.js';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

// Mock fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
  },
}));

const realFs = { realRmSync, realMkdirSync, realExistsSync };

describe('TodosTool Final Coverage Gaps', () => {
  let tempHome: string;
  let cwd: string;

  beforeEach(() => {
    const originalHome = homedir();
    tempHome = join(originalHome, '.todos-final-gap-test');
    if (realFs.realExistsSync(tempHome)) {
      realFs.realRmSync(tempHome, { recursive: true, force: true });
    }
    realFs.realMkdirSync(tempHome, { recursive: true });
    cwd = join(tempHome, 'test-project');
    realFs.realMkdirSync(cwd, { recursive: true });
    vi.stubEnv('HOME', tempHome);
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    try {
      if (realFs.realExistsSync(tempHome)) {
        realFs.realRmSync(tempHome, { recursive: true, force: true });
      }
    } catch (e) {}
  });

  describe('TodoState file operations - success', () => {
    it('loadFromFile returns true and populates state from valid file', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const persisted = {
        version: 1,
        phases: [
          { id: 'phase-2', name: 'P2', tasks: [{ id: 'task-5', content: 'T5', status: 'completed' }] }
        ],
        nextTaskId: 6,
        nextPhaseId: 3,
        updatedAt: new Date().toISOString(),
      };
      vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(persisted));
      const state = new TodoState();
      const loaded = await state.loadFromFile(cwd);
      expect(loaded).toBe(true);
      const phases = state.getPhases();
      expect(phases).toHaveLength(1);
      expect(phases[0].name).toBe('P2');
      expect(phases[0].tasks[0].content).toBe('T5');
      expect(state.nextTaskId).toBe(6);
      expect(state.nextPhaseId).toBe(3);
      expect(state.storageType).toBe('file');
    });

    it('saveToFile success writes and renames', async () => {
      vi.mocked(promises.mkdir).mockResolvedValue({});
      vi.mocked(promises.writeFile).mockResolvedValue({});
      vi.mocked(promises.rename).mockResolvedValue({});
      const state = new TodoState();
      state.addPhase('P1', [{ content: 'T1' }, { content: 'T2' }]);
      expect(state.nextTaskId).toBe(3);
      expect(state.nextPhaseId).toBe(2);
      await state.saveToFile(cwd);
      expect(promises.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(promises.writeFile).toHaveBeenCalled(); // called with temp file and data
      expect(promises.rename).toHaveBeenCalled(); // atomic rename
    });
  });

  describe('applyOp additional scenarios', () => {
    it('remove_task succeeds and returns empty errors', () => {
      const phases: TodoPhase[] = [{ id: 'p1', name: 'P1', tasks: [
        { id: 't1', content: 'T1', status: 'pending' },
        { id: 't2', content: 'T2', status: 'completed' }
      ]}];
      const { phases: result, errors } = applyOp(phases, 1, 1, { remove_task: { id: 't1' } });
      expect(result[0].tasks).toHaveLength(1);
      expect(result[0].tasks[0].id).toBe('t2');
      expect(errors).toEqual([]);
    });

    it('list with multiple phases returns unchanged', () => {
      const phases: TodoPhase[] = [
        { id: 'p1', name: 'P1', tasks: [{ id: 't1', content: 'T1', status: 'pending' }] },
        { id: 'p2', name: 'P2', tasks: [{ id: 't2', content: 'T2', status: 'completed' }] }
      ];
      const { phases: result } = applyOp(phases, 1, 1, { list: {} });
      expect(result).toEqual(phases);
    });

    it('update with single id works', () => {
      let { phases } = applyOp([], 1, 1, { add_phase: { name: 'P', tasks: [{ content: 'T' }] } });
      const taskId = phases[0].tasks[0].id;
      ({ phases } = applyOp(phases, 2, 2, { update: { id: taskId, status: 'completed' } }));
      expect(phases[0].tasks[0].status).toBe('completed');
    });

    it('delete operation resets to empty with counters 1,1', () => {
      const { phases, nextTaskId, nextPhaseId } = applyOp([{ id: 'p1', name: 'P1', tasks: [] }], 10, 5, { delete: {} });
      expect(phases).toEqual([]);
      expect(nextTaskId).toBe(1);
      expect(nextPhaseId).toBe(1);
    });
  });

  describe('formatSummary variations', () => {
    it('shows details for in_progress task multi-line', () => {
      const phases: TodoPhase[] = [{ id: 'p', name: 'P', tasks: [
        { id: 't', content: 'T', status: 'in_progress', details: 'line1\nline2' }
      ]}];
      const summary = formatSummary(phases, []);
      expect(summary).toContain('line1');
      expect(summary).toContain('line2');
    });

    it('shows phase progress X/Y format', () => {
      const phases: TodoPhase[] = [{ id: 'p', name: 'P', tasks: [
        { id: 't1', content: 'T1', status: 'completed' },
        { id: 't2', content: 'T2', status: 'pending' }
      ]}];
      const summary = formatSummary(phases, []);
      expect(summary).toMatch(/\d+\/\d+ tasks complete/);
    });
  });

  describe('getLatestTodoPhasesFromEntries additional', () => {
    it('skips entry with null details', () => {
      const entries = [{ type: 'message', message: { role: 'toolResult', toolName: 'todos', details: null } }];
      expect(getLatestTodoPhasesFromEntries(entries)).toEqual([]);
    });

    it('skips entry with non-array phases', () => {
      const entries = [{ type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases: 'not array' } } }];
      expect(getLatestTodoPhasesFromEntries(entries)).toEqual([]);
    });
  });

  describe('Tool execution full scenarios', () => {
    let mockApi: any;
    let capturedTool: any;
    let mockCtx: any;

    beforeEach(() => {
      mockApi = {
        registerTool: vi.fn((t: any) => { capturedTool = t; }),
        sendMessage: vi.fn(),
        on: vi.fn(),
      };
      mockCtx = { sessionManager: { getBranch: vi.fn().mockReturnValue([]) }, hasUI: true, cwd } as unknown as ExtensionContext;
      registerTodosTool(mockApi);
    });

    it('add_phase then list shows tasks', async () => {
      await capturedTool.execute('add', { add_phase: { name: 'P1', tasks: [{ content: 'T1' }, { content: 'T2' }] } }, undefined, undefined, mockCtx);
      const listResult = await capturedTool.execute('list', { list: {} }, undefined, undefined, mockCtx);
      expect(listResult.isError).toBe(false);
      expect(listResult.details.phases[0].tasks).toHaveLength(2);
    });

    it('add_task by phase name then update works', async () => {
      await capturedTool.execute('add', { add_phase: { name: 'MyPhase' } }, undefined, undefined, mockCtx);
      await capturedTool.execute('add2', { add_task: { phase: 'MyPhase', content: 'Task' } }, undefined, undefined, mockCtx);
      const listResult = await capturedTool.execute('list', { list: {} }, undefined, undefined, mockCtx);
      const taskId = listResult.details.phases[0].tasks[0].id;
      const upd = await capturedTool.execute('upd', { update: { id: taskId, status: 'completed' } }, undefined, undefined, mockCtx);
      expect(upd.isError).toBe(false);
      expect(upd.details.phases[0].tasks[0].status).toBe('completed');
    });

    it('remove_task success leaves empty list', async () => {
      await capturedTool.execute('add', { add_phase: { name: 'P', tasks: [{ content: 'T' }] } }, undefined, undefined, mockCtx);
      const list1 = await capturedTool.execute('list', { list: {} }, undefined, undefined, mockCtx);
      const taskId = list1.details.phases[0].tasks[0].id;
      const rem = await capturedTool.execute('rem', { remove_task: { id: taskId } }, undefined, undefined, mockCtx);
      expect(rem.isError).toBe(false);
      const list2 = await capturedTool.execute('list2', { list: {} }, undefined, undefined, mockCtx);
      expect(list2.details.phases[0].tasks).toHaveLength(0);
    });
  });
});
