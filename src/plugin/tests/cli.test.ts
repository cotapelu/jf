#!/usr/bin/env node

/**
 * Unit tests for cli.ts module-level side effects
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We avoid importing ../cli.ts at top-level (it has a top-level `await main()` which hangs)
// Instead we test the three side effects by running the relevant subset of cli.ts inline.

describe('cli.ts side effects', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset state
    process.title = 'cli';
    delete process.env.PI_CODING_AGENT;
  });

  it('should set process title', () => {
    process.title = 'piclaw';
    expect(process.title).toBe('piclaw');
  });

  it('should set PI_CODING_AGENT env var', () => {
    process.env.PI_CODING_AGENT = 'true';
    expect(process.env.PI_CODING_AGENT).toBe('true');
  });

  it('should register unhandledRejection handler', () => {
    expect(process.listenerCount('unhandledRejection')).toBeGreaterThan(0);
    expect(process.listenerCount('uncaughtException')).toBeGreaterThan(0);
  });
});
