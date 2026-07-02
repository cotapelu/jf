import { vi, describe, it, expect } from 'vitest';
import type { TodoPhase } from '../extensions/tools/todos-tool.js';

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

import {
  applyOp,
  formatSummary,
  normalizeParams,
  getLatestTodoPhasesFromEntries,
} from '../extensions/tools/todos-tool.js';

describe('TodosTool Additional Coverage (core functions)', () => {
  describe('applyOp success paths', () => {
    it('remove_task removes task and returns no errors', () => {
      const phases: TodoPhase[] = [{ id: 'p1', name: 'P1', tasks: [{ id: 't1', content: 'T', status: 'pending' as const }] }];
      const { phases: result, errors } = applyOp(phases, 1, 1, { remove_task: { id: 't1' } });
      expect(result[0].tasks).toHaveLength(0);
      expect(errors).toEqual([]);
    });

    it('list returns phases unchanged (non-empty)', () => {
      const phases: TodoPhase[] = [{ id: 'p1', name: 'P1', tasks: [{ id: 't1', content: 'T', status: 'pending' as const }] }];
      const { phases: result } = applyOp(phases, 1, 1, { list: {} });
      expect(result).toEqual(phases);
    });

    it('add_task can add to phase referenced by name', () => {
      const { phases } = applyOp([], 1, 1, { add_phase: { name: 'MyPhase', tasks: [{ content: 'T1' }] } });
      const { phases: final, errors } = applyOp(phases, 2, 2, { add_task: { phase: 'MyPhase', content: 'T2' } });
      expect(errors).toEqual([]);
      expect(final[0].tasks).toHaveLength(2);
    });

    it('update with mixed valid and unknown IDs updates valid and reports errors', () => {
      const { phases } = applyOp([], 1, 1, { add_phase: { name: 'P', tasks: [{ content: 'T1' }, { content: 'T2' }] } });
      const taskId = phases[0].tasks[0].id;
      const { phases: resultPhases, errors } = applyOp(phases, 2, 2, { update: { ids: [taskId, 'missing'], status: 'completed' } });
      expect(errors).toContain('Task "missing" not found');
      const updated = resultPhases[0].tasks.find((t: any) => t.id === taskId);
      expect(updated?.status).toBe('completed');
    });

    it('update with all unknown IDs returns error for each and "no valid tasks"', () => {
      const phases: TodoPhase[] = [{ id: 'p1', name: 'P1', tasks: [{ id: 't1', content: 'T', status: 'pending' as const }] }];
      const { errors } = applyOp(phases, 1, 1, { update: { ids: ['missing1', 'missing2'] } });
      expect(errors).toContain('Task "missing1" not found');
      expect(errors).toContain('Task "missing2" not found');
      expect(errors).toContain('No valid tasks found to update');
    });

    it('formatSummary includes errors line and remaining stats', () => {
      const phases: TodoPhase[] = [{ id: 'p1', name: 'P1', tasks: [{ id: 't1', content: 'T', status: 'pending' as const }] }];
      const summary = formatSummary(phases, ['Something went wrong']);
      expect(summary).toContain('Errors: Something went wrong');
      expect(summary).toContain('Remaining'); // "Remaining items" line
    });
  });

  describe('normalizeParams string parsing', () => {
    it('parses add_phase tasks as comma-separated when not JSON', () => {
      const result = normalizeParams({ add_phase: { name: 'P', tasks: 'T1, T2' } });
      expect(result.add_phase).toEqual({ name: 'P', tasks: [{ content: 'T1' }, { content: 'T2' }] });
    });

    it('parses add_phase tasks as JSON string when valid', () => {
      const result = normalizeParams({ add_phase: { name: 'P', tasks: '[{"content":"T1"},{"content":"T2"}]' } });
      expect(result.add_phase).toEqual({ name: 'P', tasks: [{ content: 'T1' }, { content: 'T2' }] });
    });

    it('parses add_task from JSON string', () => {
      const result = normalizeParams({ add_task: '{"phase":"phase-1","content":"T"}' });
      expect(result.add_task).toEqual({ phase: 'phase-1', content: 'T' });
    });

    it('parses update from JSON string', () => {
      const result = normalizeParams({ update: '{"id":"task-1","status":"completed"}' });
      expect(result.update).toEqual({ id: 'task-1', status: 'completed' });
    });

    it('parses delete from JSON string', () => {
      const result = normalizeParams({ delete: '{}' });
      expect(result.delete).toEqual({});
    });
  });

  describe('getLatestTodoPhasesFromEntries edge cases', () => {
    it('returns empty when entries empty', () => {
      expect(getLatestTodoPhasesFromEntries([])).toEqual([]);
    });

    it('ignores non-message entries', () => {
      const entries = [{ type: 'event' }, { type: 'message', message: { role: 'user' } }];
      expect(getLatestTodoPhasesFromEntries(entries)).toEqual([]);
    });

    it('skips wrong toolName', () => {
      const entries = [{ type: 'message', message: { role: 'toolResult', toolName: 'other' } }];
      expect(getLatestTodoPhasesFromEntries(entries)).toEqual([]);
    });

    it('skips error toolResult', () => {
      const entries = [{ type: 'message', message: { role: 'toolResult', toolName: 'todos', isError: true, details: { phases: [] } } }];
      expect(getLatestTodoPhasesFromEntries(entries)).toEqual([]);
    });

    it('returns phases from latest valid entry', () => {
      const data: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks: [] }];
      const entries = [
        { type: 'message', message: { role: 'toolResult', toolName: 'other' } },
        { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases: data } } },
      ];
      expect(getLatestTodoPhasesFromEntries(entries)).toBe(data);
    });
  });
});
