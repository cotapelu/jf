#!/usr/bin/env node
/**
 * Todos Tool normalizeParams Edge Case Tests
 */

import { describe, it, expect } from 'vitest';
import { normalizeParams } from '../todos-tool.js';

describe('todos-tool normalizeParams edge cases', () => {

  describe('add_phase.tasks string handling', () => {
    it('should split comma-separated tasks string', () => {
      const result = normalizeParams({ add_phase: { name: 'P', tasks: 't1, t2, t3' } });
      expect(result.add_phase.tasks).toEqual([
        { content: 't1' },
        { content: 't2' },
        { content: 't3' }
      ]);
    });

    it('should trim whitespace around task names', () => {
      const result = normalizeParams({ add_phase: { name: 'P', tasks: '  a  ,  b ,c ' } });
      expect(result.add_phase.tasks).toEqual([
        { content: 'a' },
        { content: 'b' },
        { content: 'c' }
      ]);
    });

    it('should handle single task string', () => {
      const result = normalizeParams({ add_phase: { name: 'P', tasks: 'single' } });
      expect(result.add_phase.tasks).toEqual([{ content: 'single' }]);
    });
  });

  describe('add_phase.name JSON object parsing', () => {
    // After fix: no longer hijack add_phase when name is JSON object string.
    it('should NOT replace add_phase when name is JSON object string (bug fixed)', () => {
      const input = { add_phase: { name: '{"name":"P","tasks":[{"content":"T"}]}', tasks: [{ content: 'Other' }] } };
      const result = normalizeParams(input);
      // Keep original add_phase structure
      expect((result.add_phase as any).name).toBe('{"name":"P","tasks":[{"content":"T"}]}');
      expect((result.add_phase as any).tasks).toHaveLength(1);
      expect((result.add_phase as any).tasks[0].content).toBe('Other');
    });

    it('should keep original name if JSON parse fails', () => {
      const input = { add_phase: { name: '{invalid json' } };
      const result = normalizeParams(input);
      expect(result.add_phase.name).toBe('{invalid json');
    });
  });

  describe('add_phase whole object string', () => {
    it('should parse add_phase as JSON string object', () => {
      const input = { add_phase: '{"name":"P","tasks":[{"content":"T1"}]}' };
      const result = normalizeParams(input);
      expect(result.add_phase).toEqual({ name: 'P', tasks: [{ content: 'T1' }] });
    });

    it('should throw on invalid JSON for add_phase string', () => {
      expect(() => normalizeParams({ add_phase: 'invalid' })).toThrow();
    });
  });

  describe('delete string handling', () => {
    it('should parse delete as JSON object', () => {
      const result = normalizeParams({ delete: '{}' });
      expect(result.delete).toEqual({});
    });

    it('should throw on invalid JSON for delete string', () => {
      expect(() => normalizeParams({ delete: 'not json' })).toThrow();
    });
  });

  describe('other operations string parsing', () => {
    it('should parse add_task string JSON', () => {
      const result = normalizeParams({ add_task: '{"phase":"phase-1","content":"T"}' });
      expect(result.add_task).toEqual({ phase: 'phase-1', content: 'T' });
    });

    it('should parse update string JSON', () => {
      const result = normalizeParams({ update: '{"id":"task-1","status":"completed"}' });
      expect(result.update).toEqual({ id: 'task-1', status: 'completed' });
    });

    it('should parse remove_task string JSON', () => {
      const result = normalizeParams({ remove_task: '{"id":"task-1"}' });
      expect(result.remove_task).toEqual({ id: 'task-1' });
    });

    it('should throw on invalid JSON for other ops', () => {
      expect(() => normalizeParams({ add_task: 'invalid' })).toThrow();
      expect(() => normalizeParams({ update: 'invalid' })).toThrow();
      expect(() => normalizeParams({ remove_task: 'invalid' })).toThrow();
    });
  });

  describe('list operation', () => {
    it('should pass through list object', () => {
      const result = normalizeParams({ list: {} });
      expect(result.list).toEqual({});
    });
  });

});
