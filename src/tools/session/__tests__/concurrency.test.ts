import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Mutex } from '../concurrency.js';

describe('Mutex', () => {
  let mutex: Mutex;

  beforeEach(() => {
    mutex = new Mutex();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('run()', () => {
    it('should execute fn immediately when not locked', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const result = await mutex.run(fn);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(result).toBe('result');
    });

    it('should lock while executing', async () => {
      let lockedDuring = false;
      const fn = vi.fn(async () => {
        lockedDuring = mutex['locked'];
        await Promise.resolve();
        return 'done';
      });
      const promise = mutex.run(fn);
      // Before await, fn hasn't finished
      expect(mutex['locked']).toBe(true);
      await promise;
      expect(mutex['locked']).toBe(false);
      expect(lockedDuring).toBe(true);
    });

    it('should release lock after execution', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      await mutex.run(fn);
      expect(mutex['locked']).toBe(false);
    });

    it('should queue second call when locked', async () => {
      const results: string[] = [];
      const fn1 = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        results.push('first');
      });
      const fn2 = vi.fn(async () => {
        results.push('second');
      });

      const p1 = mutex.run(fn1);
      const p2 = mutex.run(fn2);

      // Fast-forward time to complete fn1
      await vi.runAllTimersAsync();

      await Promise.all([p1, p2]);
      expect(results).toEqual(['first', 'second']);
    });

    it('should execute queued tasks in order', async () => {
      const order: number[] = [];
      const createFn = (id: number) => vi.fn(async () => {
        order.push(id);
      });

      const p0 = mutex.run(createFn(0));
      const p1 = mutex.run(createFn(1));
      const p2 = mutex.run(createFn(2));

      await vi.runAllTimersAsync();
      await Promise.all([p0, p1, p2]);
      expect(order).toEqual([0, 1, 2]);
    });

    it('should propagate errors from fn', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(mutex.run(fn)).rejects.toThrow('fail');
    });

    it('should still release lock if fn throws', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('error'));
      const p = mutex.run(fn);
      await expect(p).rejects.toThrow();
      // After rejection, lock should be released
      expect(mutex['locked']).toBe(false);
    });

    it('should handle multiple queued tasks with delays', async () => {
      const order: string[] = [];
      const tasks = [1, 2, 3].map(i => vi.fn(async () => {
        order.push(`start-${i}`);
        await Promise.resolve();
        order.push(`end-${i}`);
      }));

      const promises = tasks.map(t => mutex.run(t));

      // Let all microtasks complete
      await vi.runAllTimersAsync();
      await Promise.all(promises);

      // Should maintain order: start1,end1,start2,end2,start3,end3
      expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3']);
    });

    it('should not interleave queued tasks', async () => {
      const log: string[] = [];
      const fnA = vi.fn(async () => {
        log.push('A-start');
        await Promise.resolve();
        log.push('A-mid');
        await Promise.resolve();
        log.push('A-end');
      });
      const fnB = vi.fn(async () => {
        log.push('B-start');
        await Promise.resolve();
        log.push('B-mid');
        await Promise.resolve();
        log.push('B-end');
      });

      const pA = mutex.run(fnA);
      const pB = mutex.run(fnB);

      await vi.runAllTimersAsync();
      await Promise.all([pA, pB]);

      // All of A should finish before B starts
      expect(log).toEqual([
        'A-start', 'A-mid', 'A-end',
        'B-start', 'B-mid', 'B-end'
      ]);
    });

    it('should handle empty waiting queue gracefully', async () => {
      expect(mutex['waiting']).toHaveLength(0);
      const fn = vi.fn().mockResolvedValue('done');
      await mutex.run(fn);
      expect(mutex['waiting']).toHaveLength(0);
    });

    it('should allow re-entry after completion', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      await mutex.run(fn);
      expect(mutex['locked']).toBe(false);
      expect(mutex['waiting']).toHaveLength(0);
      // Run again
      await mutex.run(fn);
      expect(mutex['locked']).toBe(false);
    });

    it('should handle many queued tasks', async () => {
      const count = 100;
      const order: number[] = [];
      const fns = Array.from({ length: count }, (_, i) => vi.fn(async () => {
        order.push(i);
      }));

      const promises = fns.map(fn => mutex.run(fn));
      await vi.runAllTimersAsync();
      await Promise.all(promises);

      expect(order).toEqual(Array.from({ length: count }, (_, i) => i));
    });
  });
});
