#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import autoContinueExtension from '../extensions/hooks/auto-continue.js';

describe('auto-continue', () => {
  let mockPi: any;
  let mockCtx: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPi = { on: vi.fn(), registerCommand: vi.fn(), sendMessage: vi.fn() };
    mockCtx = { hasUI: true, isIdle: vi.fn().mockReturnValue(false), ui: { notify: vi.fn() } };
  });

  afterEach(() => { vi.useRealTimers(); });

  it('registers command and events', () => {
    autoContinueExtension(mockPi);
    expect(mockPi.registerCommand).toHaveBeenCalledWith('gnpi', expect.any(Object));
    expect(mockPi.on).toHaveBeenCalledWith('agent_end', expect.any(Function));
  });

  it('handler toggles and notifies', () => {
    autoContinueExtension(mockPi);
    const handler = mockPi.registerCommand.mock.calls[0][1].handler;
    handler('on', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('BẬT'), 'info');
  });

  it('sends reminder after timer', async () => {
    autoContinueExtension(mockPi);
    const handler = mockPi.registerCommand.mock.calls[0][1].handler;
    handler('on', mockCtx);
    const onAgentEnd = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'agent_end')?.[1];
    await onAgentEnd?.(undefined, mockCtx);
    await vi.runAllTimersAsync();
    expect(mockPi.sendMessage).toHaveBeenCalledWith(
      { customType: 'auto-continue', content: expect.any(String), display: false },
      { triggerTurn: true, deliverAs: 'followUp' }
    );
  });

  it('handler off disables and clears timer', async () => {
    autoContinueExtension(mockPi);
    const handler = mockPi.registerCommand.mock.calls[0][1].handler;
    // Enable
    handler('on', mockCtx);
    // Trigger agent_end to set timer
    const onAgentEnd = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'agent_end')?.[1];
    await onAgentEnd?.(undefined, mockCtx);
    // Timer is set
    // Disable
    handler('off', mockCtx);
    // Verify immediate notification
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('TẮT'), 'info');
    // Advance timers beyond default timeout; should not send message
    await vi.advanceTimersByTimeAsync(35000);
    expect(mockPi.sendMessage).not.toHaveBeenCalled();
  });

  it('handler sets custom timeout', async () => {
    autoContinueExtension(mockPi);
    const handler = mockPi.registerCommand.mock.calls[0][1].handler;
    // Set custom timeout (this does not enable)
    handler('15', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('15 giây'), 'info');
    // Now enable (on) to start timer with the new timeout
    handler('on', mockCtx);
    // Trigger agent_end to start timer
    const onAgentEnd = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'agent_end')?.[1];
    await onAgentEnd?.(undefined, mockCtx);
    // Advance to 15 seconds, should send reminder
    await vi.advanceTimersByTimeAsync(15000);
    expect(mockPi.sendMessage).toHaveBeenCalledWith(
      { customType: 'auto-continue', content: expect.any(String), display: false },
      { triggerTurn: true, deliverAs: 'followUp' }
    );
  });

  it('handler toggles on empty args', async () => {
    autoContinueExtension(mockPi);
    const handler = mockPi.registerCommand.mock.calls[0][1].handler;
    // Initially off
    handler('', mockCtx); // empty string toggles on
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('BẬT'), 'info');
    // Toggle off again
    handler('', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('TẮT'), 'info');
  });

  it('enables and starts timer immediately if idle', async () => {
    mockCtx.isIdle = vi.fn().mockReturnValue(true);
    autoContinueExtension(mockPi);
    const handler = mockPi.registerCommand.mock.calls[0][1].handler;
    handler('on', mockCtx);
    // Timer should start immediately; advance timers and verify
    await vi.advanceTimersByTimeAsync(30000);
    expect(mockPi.sendMessage).toHaveBeenCalled();
  });

  it('agent_end does not start timer when disabled', async () => {
    autoContinueExtension(mockPi);
    // Do not enable (enabled is false by default)
    const onAgentEnd = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'agent_end')?.[1];
    await onAgentEnd?.(undefined, mockCtx);
    // Even after advancing time, no message
    await vi.advanceTimersByTimeAsync(35000);
    expect(mockPi.sendMessage).not.toHaveBeenCalled();
  });

  it('session_shutdown clears timer', async () => {
    autoContinueExtension(mockPi);
    const handler = mockPi.registerCommand.mock.calls[0][1].handler;
    handler('on', mockCtx);
    const onAgentEnd = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'agent_end')?.[1];
    await onAgentEnd?.(undefined, mockCtx);
    // Now timer is set
    const onShutdown = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'session_shutdown')?.[1];
    await onShutdown?.();
    // After shutdown, advancing time should not send message
    await vi.advanceTimersByTimeAsync(35000);
    expect(mockPi.sendMessage).not.toHaveBeenCalled();
    // Additionally, a new agent_end after shutdown should not set a new timer because extension might still be enabled? Actually the extension continues running; but the shutdown is for the session; after shutdown maybe the extension is disposed? But we only test that timer cleared.
    // We can verify that calling agent_end again also does not send message (since timer cleared and enabled still true but startIdleTimer will be called again; actually after shutdown, the extension might be disposed, but we don't model that. So we skip further.
  });

  it('handler accepts numeric string 1 to enable (alias)', async () => {
    autoContinueExtension(mockPi);
    const handler = mockPi.registerCommand.mock.calls[0][1].handler;
    handler('1', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('BẬT'), 'info');
    const onAgentEnd = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'agent_end')?.[1];
    await onAgentEnd?.(undefined, mockCtx);
    await vi.advanceTimersByTimeAsync(30000);
    expect(mockPi.sendMessage).toHaveBeenCalled();
  });

  it('handler accepts numeric string 0 to disable', async () => {
    autoContinueExtension(mockPi);
    const handler = mockPi.registerCommand.mock.calls[0][1].handler;
    handler('0', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('TẮT'), 'info');
  });

  it('session_shutdown when idleTimer is null does nothing', async () => {
    autoContinueExtension(mockPi);
    // idleTimer is null by default (no enable)
    const onShutdown = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'session_shutdown')?.[1];
    await onShutdown?.();
    // No message should be sent
    expect(mockPi.sendMessage).not.toHaveBeenCalled();
  });

  it('toggles off via empty args and clears timer', async () => {
    // Set idle to true so enabling will start timer
    mockCtx.isIdle = vi.fn().mockReturnValue(true);
    autoContinueExtension(mockPi);
    const handler = mockPi.registerCommand.mock.calls[0][1].handler;
    // First empty arg: toggles on and starts timer (since idle)
    handler('', mockCtx);
    // At this point, the extension's internal idleTimer should be set (we can't access directly, but we can spy on clearTimeout)
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    // Second empty arg: toggles off (should clear timer via else block)
    handler('', mockCtx);
    expect(clearSpy).toHaveBeenCalled();
    // Also should notify off
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('TẮT'), 'info');
    clearSpy.mockRestore();
  });
});
