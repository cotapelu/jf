#!/usr/bin/env node

/**
 * Mutex lock for state management
 *
 * Usage:
 * const mutex = new Mutex();
 * const release = await mutex.lock();
 * try {
 *   // critical section
 * } finally {
 *   release();
 * }
 */

export class Mutex {
  private locked = false;
  private waiters: Array<(unlock: () => void) => void> = [];

  async lock(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return () => this.unlock();
    }

    // Wait in queue
    return new Promise<() => void>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  private unlock(): void {
    if (this.waiters.length > 0) {
      // Transfer lock to next waiter
      const nextResolve = this.waiters.shift()!;
      nextResolve(() => this.unlock());
    } else {
      this.locked = false;
    }
  }

  tryLock(): boolean {
    if (!this.locked) {
      this.locked = true;
      return true;
    }
    return false;
  }
}
