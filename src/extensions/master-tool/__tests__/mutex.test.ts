import { Mutex } from '../utils/mutex.js';
import { describe, it, expect } from 'vitest';

describe('Mutex', () => {
  it('should acquire lock immediately when not locked', async () => {
    const mutex = new Mutex();
    const release = await mutex.lock();
    expect(typeof release).toBe('function');
    // while locked, tryLock returns false
    expect(mutex.tryLock()).toBe(false);
    release();
    // after release, tryLock should succeed
    expect(mutex.tryLock()).toBe(true);
  });

  it('should queue when locked and serve in order', async () => {
    const mutex = new Mutex();
    const release1 = await mutex.lock();
    // lock is held

    // Second acquisition should wait
    const lock2Promise = mutex.lock();
    // Not resolved yet
    let resolved = false;
    lock2Promise.then(() => { resolved = true; });
    expect(resolved).toBe(false);

    // Release first
    release1();
    // Now second should resolve
    const release2 = await lock2Promise;
    expect(typeof release2).toBe('function');
    // While second holds, tryLock false
    expect(mutex.tryLock()).toBe(false);
    release2();
    // After releasing second, lock free
    expect(mutex.tryLock()).toBe(true);
  });

  it('should transfer lock through multiple waiters', async () => {
    const mutex = new Mutex();
    const r1 = await mutex.lock();
    const p2 = mutex.lock();
    const p3 = mutex.lock();

    // Release first, second should get
    r1();
    const r2 = await p2;
    expect(mutex.tryLock()).toBe(false);
    // Release second, third should get
    r2();
    const r3 = await p3;
    expect(mutex.tryLock()).toBe(false);
    r3();
    expect(mutex.tryLock()).toBe(true);
  });

  it('tryLock should return true when unlocked', () => {
    const mutex = new Mutex();
    expect(mutex.tryLock()).toBe(true);
    // After tryLock, locked state should be true
    expect(mutex.tryLock()).toBe(false);
    // Need to unlock to reset for other tests? We can't directly set locked. We'll create new mutex for next tests.
  });

  it('unlock with no waiters should set locked to false', async () => {
    const mutex = new Mutex();
    const release = await mutex.lock();
    expect(mutex.tryLock()).toBe(false);
    release();
    // No waiters, locked false → tryLock succeeds
    expect(mutex.tryLock()).toBe(true);
  });
});
