/**
 * Async Mutex - Simple reentrancy-safe lock for async operations
 *
 * Provides a clean way to serialize async operations and prevent race conditions.
 * Usage:
 *   const mutex = new Mutex();
 *   const release = await mutex.lock();
 *   try {
 *     // critical section
 *   } finally {
 *     release();
 *   }
 */

export class Mutex {
  private locked = false;
  private queue: Array<() => void> = [];
  async lock(): Promise<() => void> {
    if (!this.locked) { this.locked = true; return () => this.unlock(); }
    return new Promise(resolve => { this.queue.push(() => resolve(() => this.unlock())); });
  }
  private unlock(): void {
    if (this.queue.length > 0) { const next = this.queue.shift()!; next(); } else { this.locked = false; }
  }
}


