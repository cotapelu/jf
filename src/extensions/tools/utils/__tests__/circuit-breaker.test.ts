import { CircuitBreaker } from '../circuit-breaker.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({ failureThreshold: 3, timeoutMs: 1000, halfOpenMax: 1 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('initial state should be closed', () => {
    expect(breaker.getState()).toBe('closed');
    expect(breaker.isAvailable()).toBe(true);
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('success does not change state', async () => {
    const result = await breaker.execute(async () => 'ok');
    expect(result).toBe('ok');
    expect(breaker.getState()).toBe('closed');
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('failure increments count but stays closed until threshold', async () => {
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch (e) {}
    }
    expect(breaker.getState()).toBe('closed');
    expect(breaker.getFailureCount()).toBe(2);
  });

  it('opens after reaching failureThreshold', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch (e) {}
    }
    expect(breaker.getState()).toBe('open');
    expect(breaker.isAvailable()).toBe(false);
  });

  it('throws when open without waiting', async () => {
    // Open the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch (e) {}
    }
    // Next call should throw immediately
    await expect(breaker.execute(async () => 'ok')).rejects.toThrow('Circuit breaker is OPEN - service unavailable');
  });

  it('transitions to half-open after timeout', async () => {
    // Open the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch (e) {}
    }
    // Advance time beyond timeout
    vi.advanceTimersByTime(1001);
    // Next call should be allowed (half-open)
    try {
      await breaker.execute(async () => { throw new Error('fail'); });
    } catch (e) {}
    // After failure in half-open, should go back to open
    expect(breaker.getState()).toBe('open');
  });

  it('half-open success closes the circuit', async () => {
    // Open the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch (e) {}
    }
    vi.advanceTimersByTime(1001);
    // Successful call in half-open
    const res = await breaker.execute(async () => 'ok');
    expect(res).toBe('ok');
    expect(breaker.getState()).toBe('closed');
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('reset clears state', async () => {
    // Open the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch (e) {}
    }
    breaker.reset();
    expect(breaker.getState()).toBe('closed');
    expect(breaker.getFailureCount()).toBe(0);
    expect(breaker.isAvailable()).toBe(true);
  });

  it('half-open respects halfOpenMax', async () => {
    // Open then advance to half-open
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch (e) {}
    }
    vi.advanceTimersByTime(1001);
    // First failing call in half-open should go to open
    try {
      await breaker.execute(async () => { throw new Error('fail'); });
    } catch (e) {}
    expect(breaker.getState()).toBe('open');
    // Further calls should throw immediately with OPEN error
    await expect(breaker.execute(async () => 'ok')).rejects.toThrow('Circuit breaker is OPEN - service unavailable');
  });
});
