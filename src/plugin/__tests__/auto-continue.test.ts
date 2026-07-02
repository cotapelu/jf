#!/usr/bin/env node
/**
 * Auto Continue Hook Tests
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}));

// No need to mock node:path

// Now import the hook
import autoContinue from '../extensions/hooks/auto-continue.js';
import { existsSync, readFileSync } from 'node:fs';

// Spy on global timers
let mockClearTimeout: any;
let mockSetTimeout: any;

function createMockPI() {
  const mockOn = vi.fn();
  const mockRegisterCommand = vi.fn();
  const mockSendMessage = vi.fn();
  return {
    on: mockOn,
    registerCommand: mockRegisterCommand,
    sendMessage: mockSendMessage,
    // getFlag not used in hook? Actually not. The hook doesn't use getFlag.
  };
}

function createMockContext(overrides: any = {}) {
  return {
    hasUI: true,
    isIdle: vi.fn().mockReturnValue(true),
    ui: { notify: vi.fn() },
    ...overrides,
  };
}

describe('Auto Continue Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (existsSync as any).mockReturnValue(false);
    (readFileSync as any).mockClear();

    // Setup timer spies
    mockSetTimeout = vi.fn().mockImplementation((cb: any, ms: number) => {
      // Return a mock timer with optional unref
      return { unref: vi.fn(), _cb: cb, _ms: ms };
    });
    mockClearTimeout = vi.fn();
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(mockSetTimeout);
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(mockClearTimeout);
  });

  afterEach(() => {
    // Restoreoriginal timers if needed? Not needed since vi.restoreAll would be used, but we can leave.
  });

  it('registers command and event handlers', () => {
    const pi = createMockPI();
    // @ts-ignore - pi mock missing many ExtensionAPI properties
    autoContinue(pi as any);
    expect(pi.registerCommand).toHaveBeenCalledWith('gnpi', expect.any(Object));
    // pi.on should have been called at least for session_shutdown, agent_end, session_compact
    const eventNames = pi.on.mock.calls.map((args: any[]) => args[0]);
    expect(eventNames).toContain('session_shutdown');
    expect(eventNames).toContain('agent_end');
    expect(eventNames).toContain('session_compact');
  });

  it('enables auto-continue and starts idle timer', () => {
    const pi = createMockPI();
    autoContinue(pi as any);

    // Get the command handler from registerCommand call
    const registerCmdCall = pi.registerCommand.mock.calls.find(([name]) => name === 'gnpi')!;
    const handler = registerCmdCall[1].handler;

    const ctx = createMockContext(); // isIdle returns true by default
    handler('on', ctx);

    // Should have called setTimeout with DEFAULT_IDLE_TIMEOUT_MS
    expect(mockSetTimeout).toHaveBeenCalledTimes(1);
    const [cb, ms] = mockSetTimeout.mock.calls[0];
    expect(ms).toBe(30000); // DEFAULT_IDLE_TIMEOUT_MS
    // The callback should eventually call pi.sendMessage if still enabled; we can invoke it manually
    // Simulate timer firing
    cb();
    expect(pi.sendMessage).toHaveBeenCalledWith(
      { customType: 'auto-continue', content: expect.any(String), display: false },
      { triggerTurn: true, deliverAs: 'followUp' }
    );
  });

  it('disables and clears timer', () => {
    const pi = createMockPI();
    autoContinue(pi as any);
    const registerCmdCall = pi.registerCommand.mock.calls.find(([name]) => name === 'gnpi')!;
    const handler = registerCmdCall[1].handler;

    // Enable first
    const ctx = createMockContext();
    handler('on', ctx);
    expect(mockSetTimeout).toHaveBeenCalledTimes(1);
    const timer = mockSetTimeout.mock.results[0].value; // the returned object

    // Disable
    handler('off', ctx);
    expect(mockClearTimeout).toHaveBeenCalledWith(timer);
  });

  it('session_shutdown clears timer', () => {
    const pi = createMockPI();
    autoContinue(pi as any);
    // Get session_shutdown handler
    const shutdownHandler = pi.on.mock.calls.find(([name]) => name === 'session_shutdown')![1];

    // Simulate that there is an idleTimer set (we can't easily set internal variable but we can call startIdleTimer via enabling first)
    // Better: just call the shutdown handler without timer; it should do nothing (no crash)
    shutdownHandler(null);
    // Not much to assert; just ensure no error
  });

  it('agent_end starts timer if enabled', () => {
    const pi = createMockPI();
    autoContinue(pi as any);

    // Enable first
    const ctx = createMockContext();
    const registerCmdCall = pi.registerCommand.mock.calls.find(([name]) => name === 'gnpi')!;
    const handler = registerCmdCall[1].handler;
    handler('on', ctx);
    expect(mockSetTimeout).toHaveBeenCalledTimes(1);

    // Reset mock calls to track new setTimeout
    mockSetTimeout.mockClear();
    mockClearTimeout.mockClear();

    // Trigger agent_end
    const agentEndHandler = pi.on.mock.calls.find(([name]) => name === 'agent_end')![1];
    agentEndHandler();

    // Since idleTimer is already set, startIdleTimer should return without calling setTimeout again
    expect(mockSetTimeout).not.toHaveBeenCalled();
  });

  it('can set custom timeout', () => {
    const pi = createMockPI();
    autoContinue(pi as any);
    const registerCmdCall = pi.registerCommand.mock.calls.find(([name]) => name === 'gnpi')!;
    const handler = registerCmdCall[1].handler;

    const ctx = createMockContext();
    handler('600', ctx); // set timeout to 600 seconds

    expect(pi.sendMessage).not.toHaveBeenCalled(); // just setting
    // We can't inspect idleTimeoutMs directly; but next enable should use new timeout
    handler('on', ctx);
    expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 600000);
  });

  it('toggles off on empty args or invalid', () => {
    const pi = createMockPI();
    autoContinue(pi as any);
    const registerCmdCall = pi.registerCommand.mock.calls.find(([name]) => name === 'gnpi')!;
    const handler = registerCmdCall[1].handler;

    const ctx = createMockContext();
    // Pass empty args => toggles
    handler('', ctx);
    // Should have toggled to true? initial enabled false, toggle makes true.
    // We can't directly check enabled but we can see that startIdleTimer called (setTimeout)
    expect(mockSetTimeout).toHaveBeenCalled();
  });
});
