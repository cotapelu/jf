import { describe, it, expect } from 'vitest';
import { applyOp } from '../extensions/tools/todos-tool.js';

describe('TodosTool Type Error Branches', () => {
  describe('applyOp non-object operation values', () => {
    it('add_phase must be an object', () => {
      // @ts-ignore
      const { errors } = applyOp([], 1, 1, { add_phase: 'not an object' });
      expect(errors).toContain('add_phase must be an object');
    });

    it('add_task must be an object', () => {
      // @ts-ignore
      const { errors } = applyOp([], 1, 1, { add_task: 'string' });
      expect(errors).toContain('add_task must be an object');
    });

    it('update must be an object', () => {
      // @ts-ignore
      const { errors } = applyOp([], 1, 1, { update: 123 });
      expect(errors).toContain('update must be an object');
    });

    it('remove_task must be an object', () => {
      // @ts-ignore
      const { errors } = applyOp([], 1, 1, { remove_task: 'bad' });
      expect(errors).toContain('remove_task must be an object');
    });
  });
});
