#!/usr/bin/env node
/**
 * Branch coverage for copy-command
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the external module before imports
vi.mock('@earendil-works/pi-coding-agent', async () => {
  const originalModule = await vi.importActual('@earendil-works/pi-coding-agent');
  return {
    ...originalModule,
    copyToClipboard: vi.fn().mockResolvedValue(undefined),
  };
});

const { registerCopyCommand } = await import('../extensions/commands/copy-command.js');
import { createMockExtensionAPI } from '../tests/utils/mock-factory.js';

const mockNotify = vi.fn();

function createMockCtx(overrides: Partial<any> = {}): any {
  return {
    sessionManager: { getTree: vi.fn().mockReturnValue([]) },
    ui: { notify: mockNotify },
    cwd: process.cwd(),
    exec: vi.fn(),
    signal: undefined,
    isIdle: vi.fn().mockReturnValue(true),
    isProjectTrusted: vi.fn().mockReturnValue(true),
    mode: 'tui' as const,
    hasUI: true,
    ...overrides,
  };
}

function createMockApi() {
  return createMockExtensionAPI();
}

describe('Copy Command (Branch Coverage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotify.mockClear();
  });

  it('handles getTree throwing exception', async () => {
    const api = createMockApi();
    registerCopyCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;

    const getTree = vi.fn().mockImplementation(() => { throw new Error('tree error'); });
    const ctx = createMockCtx({ sessionManager: { getTree } });
    await handler('', ctx);

    expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining('Failed to copy'), 'error');
  });

  it('handles copyToClipboard throwing non-Error object without message', async () => {
    const { copyToClipboard } = await import('@earendil-works/pi-coding-agent');
    vi.mocked(copyToClipboard).mockRejectedValue({}); // no message

    const api = createMockApi();
    registerCopyCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;

    const tree = [
      { entry: { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] } } }
    ];
    const ctx = createMockCtx({ sessionManager: { getTree: vi.fn().mockReturnValue(tree) } });
    await handler('', ctx);

    expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining('unknown error'), 'error');
  });

  it('handles assistant message with only non-text content', async () => {
    const api = createMockApi();
    registerCopyCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;

    const tree = [
      { entry: { type: 'message', message: { role: 'assistant', content: [{ type: 'image', src: 'test.png' }] } } }
    ];
    const ctx = createMockCtx({ sessionManager: { getTree: vi.fn().mockReturnValue(tree) } });
    await handler('', ctx);

    expect(mockNotify).toHaveBeenCalledWith('No assistant response found', 'error');
  });

  it('handles assistant message with mixed text and non-text content', async () => {
    const { copyToClipboard } = await import('@earendil-works/pi-coding-agent');
    const api = createMockApi();
    registerCopyCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;

    const tree = [
      { entry: { type: 'message', message: { role: 'assistant', content: [
        { type: 'text', text: 'Hello' },
        { type: 'image', src: 'test.png' },
        { type: 'text', text: ' world' }
      ] } } }
    ];
    const ctx = createMockCtx({ sessionManager: { getTree: vi.fn().mockReturnValue(tree) } });
    await handler('', ctx);

    expect(copyToClipboard).toHaveBeenCalledWith('Hello\n world');
  });
});
