#!/usr/bin/env node
/**
 * Todos Tool Core Logic Tests
 * Tests: applyOp, formatSummary, normalizeParams
 */

import { describe, it, expect } from 'vitest';
import {
  applyOp,
  formatSummary,
  normalizeParams,
  TodoPhase,
  TodoItem,
} from '../todos-tool.js';

// Helper to create a phase with deterministic IDs
function makePhase(name: string, tasks: Array<{ id?: string; content: string; status?: string }> = [], phaseId = 'phase-1'): TodoPhase {
  let taskIdx = 1;
  return {
    id: phaseId,
    name,
    tasks: tasks.map(t => ({
      id: t.id || `task-${taskIdx++}`,
      content: t.content,
      status: (t.status as any) || 'pending',
      notes: undefined,
      details: undefined,
    }))
  };
}

// Initial state helper
function initialState(phases: TodoPhase[] = [], nextTaskId = 1, nextPhaseId = 1) {
  return { phases, nextTaskId, nextPhaseId };
}

describe('todos-tool applyOp', () => {

  describe('add_phase', () => {
    it('should add new phase with no tasks', () => {
      const state = initialState([], 1, 1);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, {
        add_phase: { name: 'Sprint 1' }
      });

      expect(result.errors).toHaveLength(0);
      expect(result.phases).toHaveLength(1);
      expect(result.phases[0].name).toBe('Sprint 1');
      expect(result.phases[0].tasks).toHaveLength(0);
      expect(result.nextPhaseId).toBe(2);
    });

    it('should add phase with tasks', () => {
      const state = initialState([], 1, 1);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, {
        add_phase: {
          name: 'Phase A',
          tasks: [{ content: 'Task 1' }, { content: 'Task 2', status: 'in_progress' }]
        }
      });

      expect(result.errors).toHaveLength(0);
      expect(result.phases).toHaveLength(1);
      expect(result.phases[0].tasks).toHaveLength(2);
      expect(result.phases[0].tasks[0].content).toBe('Task 1');
      expect(result.phases[0].tasks[0].status).toBe('pending');
      expect(result.phases[0].tasks[1].status).toBe('in_progress');
      expect(result.nextTaskId).toBe(3);
      expect(result.nextPhaseId).toBe(2);
    });
  });

  describe('add_task', () => {
    it('should add task to existing phase by ID', () => {
      const ph = makePhase('P1', [{ content: 'Existing', id: 'task-1' }], 'phase-1');
      const state = initialState([ph], 2, 2);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, {
        add_task: { phase: 'phase-1', content: 'New task' }
      });

      expect(result.errors).toHaveLength(0);
      expect(result.phases[0].tasks).toHaveLength(2);
      expect(result.phases[0].tasks[1].content).toBe('New task');
      expect(result.nextTaskId).toBe(3);
    });

    it('should add task to phase by name', () => {
      const ph = makePhase('My Phase', [], 'phase-1');
      const state = initialState([ph], 1, 2);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, {
        add_task: { phase: 'My Phase', content: 'Task in named phase' }
      });

      expect(result.errors).toHaveLength(0);
      expect(result.phases[0].tasks).toHaveLength(1);
    });

    it('should error if phase not found', () => {
      const state = initialState([makePhase('P1', [], 'phase-1')], 1, 2);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, {
        add_task: { phase: 'nonexistent', content: 'Task' }
      });

      expect(result.errors).toContain('Phase "nonexistent" not found');
      expect(result.phases).toHaveLength(1); // unchanged
    });
  });

  describe('update', () => {
    it('should update task by single id', () => {
      const ph = makePhase('P1', [{ content: 'Old', id: 'task-1', status: 'pending' }], 'phase-1');
      const state = initialState([ph], 2, 2);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, {
        update: { id: 'task-1', status: 'completed', content: 'New' }
      });

      expect(result.errors).toHaveLength(0);
      const task = result.phases[0].tasks[0];
      expect(task.status).toBe('completed');
      expect(task.content).toBe('New');
    });

    it('should batch update with ids array and auto-normalize in_progress', () => {
      const ph = makePhase('P1', [
        { content: 'T1', id: 'task-1', status: 'pending' },
        { content: 'T2', id: 'task-2', status: 'pending' },
      ], 'phase-1');
      const state = initialState([ph], 3, 2);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, {
        update: { ids: ['task-1', 'task-2'], status: 'in_progress' }
      });

      expect(result.errors).toHaveLength(0);
      const tasks = result.phases[0].tasks;
      // After normalization, exactly one in_progress, one pending
      const inProg = tasks.filter(t => t.status === 'in_progress');
      const pending = tasks.filter(t => t.status === 'pending');
      expect(inProg.length).toBe(1);
      expect(pending.length).toBe(1);
    });

    it('should error if task not found', () => {
      const state = initialState([makePhase('P1', [], 'phase-1')], 1, 2);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, {
        update: { id: 'missing', status: 'completed' }
      });

      expect(result.errors).toContain('Task "missing" not found');
    });

    it('should error if invalid status', () => {
      const ph = makePhase('P1', [{ content: 'T', id: 'task-1' }], 'phase-1');
      const state = initialState([ph], 2, 2);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, {
        update: { id: 'task-1', status: 'invalid' as any }
      });

      expect(result.errors[0]).toContain('Invalid status');
    });
  });

  describe('remove_task', () => {
    it('should remove task by id', () => {
      const ph = makePhase('P1', [{ content: 'T', id: 'task-1' }], 'phase-1');
      const state = initialState([ph], 2, 2);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, {
        remove_task: { id: 'task-1' }
      });

      expect(result.errors).toHaveLength(0);
      expect(result.phases[0].tasks).toHaveLength(0);
    });

    it('should error if task not found', () => {
      const state = initialState([makePhase('P1', [], 'phase-1')], 1, 2);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, {
        remove_task: { id: 'missing' }
      });

      expect(result.errors).toContain('Task "missing" not found');
    });
  });

  describe('delete', () => {
    it('should clear all phases and reset IDs', () => {
      const ph = makePhase('P1', [{ content: 'T', id: 'task-1' }], 'phase-1');
      const state = initialState([ph], 2, 2);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, { delete: {} });

      expect(result.errors).toHaveLength(0);
      expect(result.phases).toHaveLength(0);
      expect(result.nextTaskId).toBe(1);
      expect(result.nextPhaseId).toBe(1);
    });
  });

  describe('list', () => {
    it('should return same state', () => {
      const ph = makePhase('P1', [{ content: 'T', id: 'task-1' }], 'phase-1');
      const state = initialState([ph], 2, 2);
      const result = applyOp(state.phases, state.nextTaskId, state.nextPhaseId, { list: {} });

      expect(result.errors).toHaveLength(0);
      expect(result.phases).toHaveLength(1);
    });
  });

});

describe('todos-tool formatSummary', () => {
  it('should show empty when no tasks and no errors', () => {
    const phases: TodoPhase[] = [];
    const summary = formatSummary(phases, []);
    expect(summary).toBe('Todo list cleared.');
  });

  it('should list remaining tasks with status brackets', () => {
    const ph = makePhase('Dev', [
      { content: 'Pending task', id: 'task-1', status: 'pending' },
      { content: 'In progress task', id: 'task-2', status: 'in_progress' },
      { content: 'Completed task', id: 'task-3', status: 'completed' },
    ], 'phase-1');
    const summary = formatSummary([ph], []);

    expect(summary).toContain('task-1');
    expect(summary).toContain('task-2');
    // pending and in_progress status appear in brackets (e.g., [pending])
    expect(summary).toContain('[pending]');
    expect(summary).toContain('[in_progress]');
    // completed not listed as remaining? completed tasks are not in remaining list? Actually formatSummary includes all remaining tasks (pending/in_progress). Completed should not be listed in remaining tasks list.
    expect(summary).not.toContain('[completed]');
  });

  it('should report errors at top', () => {
    const summary = formatSummary([], ['Validation error']);
    expect(summary).toContain('Errors: Validation error');
  });
});

describe('todos-tool normalizeParams', () => {
  it('should parse JSON string', () => {
    const result = normalizeParams('{"add_task":{"phase":"phase-1","content":"Test"}}');
    expect(result.add_task).toEqual({ phase: 'phase-1', content: 'Test' });
  });

  it('should pass through object', () => {
    const obj = { add_phase: { name: 'P' } };
    const result = normalizeParams(obj);
    expect(result).toBe(obj);
  });

  it('should throw on invalid JSON string', () => {
    expect(() => normalizeParams('{invalid}')).toThrow('Invalid JSON');
  });

  it('should throw on null (non-object)', () => {
    // @ts-ignore
    expect(() => normalizeParams(null)).toThrow('Parameters must be an object');
  });
});
