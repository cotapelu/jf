import { describe, it, expect, vi, beforeEach } from 'vitest';
import autoCompact85 from './auto-compact-85.js';

describe('auto-compact-85 hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register turn_end listener on extension API', () => {
    const mockPi = {
      on: vi.fn()
    };
    // @ts-ignore - passing mock ExtensionAPI with only 'on'
    autoCompact85(mockPi);
    expect(mockPi.on).toHaveBeenCalledWith('turn_end', expect.any(Function));
  });

  it('should compact when context usage exceeds threshold', async () => {
    const mockCompact = vi.fn().mockResolvedValue(undefined);
    const mockCtx = {
      getContextUsage: () => ({ percent: 90 }),
      compact: mockCompact
    };
    const handler = vi.fn(); // will be the registered callback

    const mockPi = {
      on: (event: string, cb: any) => {
        if (event === 'turn_end') handler.mockImplementation(cb);
      }
    };

    // @ts-ignore - passing mock ExtensionAPI with only 'on'
    autoCompact85(mockPi);

    // Simulate turn_end event
    await handler({}, mockCtx);

    expect(mockCompact).toHaveBeenCalledTimes(1);
  });

  it('should not compact when usage below threshold', async () => {
    const mockCompact = vi.fn().mockResolvedValue(undefined);
    const mockCtx = {
      getContextUsage: () => ({ percent: 80 }),
      compact: mockCompact
    };
    const handler = vi.fn();

    const mockPi = {
      on: (event: string, cb: any) => {
        if (event === 'turn_end') handler.mockImplementation(cb);
      }
    };

    // @ts-ignore - passing mock ExtensionAPI with only 'on'
    autoCompact85(mockPi);
    await handler({}, mockCtx);

    expect(mockCompact).not.toHaveBeenCalled();
  });

  it('should not compact when usage undefined', async () => {
    const mockCompact = vi.fn().mockResolvedValue(undefined);
    const mockCtx = {
      getContextUsage: () => undefined,
      compact: mockCompact
    };
    const handler = vi.fn();

    const mockPi = {
      on: (event: string, cb: any) => {
        if (event === 'turn_end') handler.mockImplementation(cb);
      }
    };

    // @ts-ignore - passing mock ExtensionAPI with only 'on'
    autoCompact85(mockPi);
    await handler({}, mockCtx);

    expect(mockCompact).not.toHaveBeenCalled();
  });
});
