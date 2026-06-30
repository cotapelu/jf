import { AgentTeam } from '../team-manager.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('AgentTeam lock ordering', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    vi.useFakeTimers(); // not required but ensure consistent environment
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queues and executes withLock calls in FIFO order', async () => {
    const order: number[] = [];

    // First lock holder that will pause
    let resume1: (value: void) => void;
    const wait1 = new Promise<void>(r => { resume1 = r; });
    const p1 = team.withLock(async () => {
      order.push(1);
      await wait1; // pause while holding lock
      order.push('1-after');
    });

    // Ensure p1 has started and is paused
    await Promise.resolve(); // allow microtasks (withLock continuation) to run

    // Second lock call while first holds lock
    let resume2: (value: void) => void;
    const wait2 = new Promise<void>(r => { resume2 = r; });
    const p2 = team.withLock(async () => {
      order.push(2);
      await wait2; // will pause after starting
      order.push('2-after');
    });
    // Ensure p2 has been queued (not started)
    await Promise.resolve();

    // Release first
    resume1();
    await p1; // p1 completes and releases lock

    // At this point, p2 should have started and paused on wait2
    resume2();
    await p2;

    expect(order).toEqual([1, '1-after', 2, '2-after']);
  });

  it('executes later queued calls after earlier completes even if earlier throws', async () => {
    const order: number[] = [];

    let resume1: (value: void) => void;
    const wait1 = new Promise<void>(r => { resume1 = r; });
    const p1 = team.withLock(async () => {
      order.push(1);
      await wait1;
      throw new Error('p1 error');
    });
    await Promise.resolve();

    let resume2: (value: void) => void;
    const wait2 = new Promise<void>(r => { resume2 = r; });
    const p2 = team.withLock(async () => {
      order.push(2);
      await wait2;
      order.push('2-after');
    });
    await Promise.resolve();

    resume1();
    try {
      await p1;
    } catch (e) {}

    // p2 should run after p1 completes (even though p1 threw)
    resume2();
    await p2;

    expect(order).toEqual([1, 2, '2-after']);
  });
});
