import { describe, it, expect, vi } from 'vitest';
import { Mutex } from '../extensions/utils/mutex.js';

describe('Mutex', () => {
  it('should acquire lock immediately when not locked', async () => {
    const mutex = new Mutex();
    const release = await mutex.lock();
    expect(typeof release).toBe('function');
    // After acquiring, lock should be held
    release();
  });

  it('should queue lock requests when already locked', async () => {
    const mutex = new Mutex();
    const release1 = await mutex.lock();

    // Second lock request should be queued
    const lock2Promise = mutex.lock();
    // Not resolved yet

    // Release first lock
    release1();

    // Now second should resolve
    const release2 = await lock2Promise;
    expect(typeof release2).toBe('function');

    release2();
  });

  it('should handle multiple queued locks in order', async () => {
    const mutex = new Mutex();
    const results: number[] = [];

    // Acquire first
    const release1 = await mutex.lock();

    // Queue three more
    const p2 = mutex.lock().then(r => { results.push(2); return r; });
    const p3 = mutex.lock().then(r => { results.push(3); return r; });
    const p4 = mutex.lock().then(r => { results.push(4); return r; });

    // Release first to allow second
    release1();
    const release2 = await p2;
    release2(); // release to allow third

    const release3 = await p3;
    release3(); // release to allow fourth

    const release4 = await p4;
    release4();

    expect(results).toEqual([2, 3, 4]);
  });

  it('should allow re-acquire after release', async () => {
    const mutex = new Mutex();
    const release1 = await mutex.lock();
    release1();

    // After release, lock is free, should be able to acquire again
    const release2 = await mutex.lock();
    expect(typeof release2).toBe('function');
    release2();
  });

  it('should unlock correctly when release called', async () => {
    const mutex = new Mutex();
    const release = await mutex.lock();

    // Attempt to acquire while locked should wait
    const secondLock = mutex.lock();
    // Not resolve yet

    release();

    const secondRelease = await secondLock;
    expect(typeof secondRelease).toBe('function');
    secondRelease();
  });
});
