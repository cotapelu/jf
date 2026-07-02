#!/usr/bin/env node
/**
 * Settings Command Tests
 *
 * Covers: registration, TUI requirement, items building from settings,
 * model/thinking edit success, thinking fallback, and error handling.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- Mocks setup (avoid TDZ via var) ---
var mockSettingsManager: any;
var capturedSettingsListArgs: any[] = [];

// Mock pi-coding-agent: provide SettingsManager, getAgentDir, getSettingsListTheme
vi.mock('@earendil-works/pi-coding-agent', () => {
  mockSettingsManager = {
    getDefaultModel: vi.fn(),
    getDefaultThinkingLevel: vi.fn(),
    setDefaultModel: vi.fn(),
    setDefaultThinkingLevel: vi.fn(),
  };
  return {
    getAgentDir: vi.fn().mockReturnValue('/agent'),
    SettingsManager: { create: vi.fn().mockReturnValue(mockSettingsManager) },
    getSettingsListTheme: vi.fn().mockReturnValue({}),
  };
});

// Mock pi-tui: Container, Text, Spacer, DynamicBorder, SettingsList
vi.mock('@earendil-works/pi-tui', () => {
  class Container {
    children: any[] = [];
    addChild(child: any) { this.children.push(child); }
    removeChild(child: any) {
      const idx = this.children.indexOf(child);
      if (idx > -1) this.children.splice(idx, 1);
    }
    render() { return []; }
    invalidate() {}
  }
  class Text { constructor(public content: any) {} }
  class Spacer {}
  class DynamicBorder {}
  class SettingsList {
    constructor(...args: any[]) {
      capturedSettingsListArgs = args;
    }
    handleInput() {}
    // optional updateItems used in tests
    updateItems() {}
  }
  return { Container, Text, Spacer, DynamicBorder, SettingsList };
});

// Mock local widget helper
vi.mock('../utils/widget-helpers.js', () => ({
  addSectionHeader: vi.fn(),
}));

// Import after mocks
import { registerSettingsCommand } from '../extensions/commands/settings-command.js';

function createMockAPI() {
  return { registerCommand: vi.fn() } as any;
}
function createMockTheme() {
  return { fg: (c: string, s: string) => s, bold: (s: string) => s };
}

describe('Settings Command', () => {
  let ctx: any;
  let renderFn: any;
  let tui: any;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedSettingsListArgs = [];
    // Default manager returns (set in each test as needed)
    if (mockSettingsManager) {
      mockSettingsManager.getDefaultModel.mockReset();
      mockSettingsManager.getDefaultThinkingLevel.mockReset();
      mockSettingsManager.setDefaultModel.mockReset();
      mockSettingsManager.setDefaultThinkingLevel.mockReset();
    }
  });

  it('registers the /settings command', () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    expect(api.registerCommand).toHaveBeenCalledWith(
      'settings',
      expect.objectContaining({
        description: expect.stringContaining('Configure Piclaw settings'),
        handler: expect.any(Function),
      })
    );
  });

  it('requires TUI mode', async () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    ctx = { hasUI: false, ui: { notify: vi.fn() } } as any;
    await handler('', ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith('/settings requires TUI mode', 'error');
  });

  it('builds correct items from settings and renders UI', async () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    ctx = { hasUI: true, cwd: '/repo', ui: { custom: vi.fn(), notify: vi.fn() } } as any;

    mockSettingsManager.getDefaultModel.mockReturnValue('gpt-4o');
    mockSettingsManager.getDefaultThinkingLevel.mockReturnValue('medium');

    await handler('', ctx);

    // UI custom renderer should be called
    expect(ctx.ui.custom).toHaveBeenCalled();
    renderFn = ctx.ui.custom.mock.calls[0][0] as Function;
    tui = { requestRender: vi.fn() };
    const theme = createMockTheme();
    renderFn(tui, theme, {}, vi.fn());

    // Check SettingsList was constructed with items and onEdit
    expect(capturedSettingsListArgs.length).toBeGreaterThanOrEqual(4);
    const items = capturedSettingsListArgs[0];
    expect(items).toEqual([
      { id: 'model', label: 'Default Model', currentValue: 'gpt-4o', values: expect.any(Array) },
      { id: 'thinking', label: 'Thinking Level', currentValue: 'medium', values: expect.any(Array) },
    ]);
    const onEdit = capturedSettingsListArgs[3];
    expect(typeof onEdit).toBe('function');
  });

  it('calls setDefaultModel when model is edited', async () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    ctx = { hasUI: true, cwd: '/repo', ui: { custom: vi.fn(), notify: vi.fn() } } as any;

    mockSettingsManager.getDefaultModel.mockReturnValue('');
    mockSettingsManager.getDefaultThinkingLevel.mockReturnValue('medium');

    await handler('', ctx);
    renderFn = ctx.ui.custom.mock.calls[0][0] as Function;
    tui = { requestRender: vi.fn() };
    renderFn(tui, createMockTheme(), {}, vi.fn());

    const onEdit = capturedSettingsListArgs[3];
    await onEdit('model', 'openai:gpt-4o');

    expect(mockSettingsManager.setDefaultModel).toHaveBeenCalledWith('openai:gpt-4o');
    expect(ctx.ui.notify).toHaveBeenCalledWith('Saved model = openai:gpt-4o', 'info');
  });

  it('falls back to medium for invalid thinking level', async () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    ctx = { hasUI: true, cwd: '/repo', ui: { custom: vi.fn(), notify: vi.fn() } } as any;

    mockSettingsManager.getDefaultModel.mockReturnValue('gpt-4o');
    mockSettingsManager.getDefaultThinkingLevel.mockReturnValue('medium');

    await handler('', ctx);
    renderFn = ctx.ui.custom.mock.calls[0][0] as Function;
    tui = { requestRender: vi.fn() };
    renderFn(tui, createMockTheme(), {}, vi.fn());

    const onEdit = capturedSettingsListArgs[3];
    await onEdit('thinking', 'invalid');

    expect(mockSettingsManager.setDefaultThinkingLevel).toHaveBeenCalledWith('medium');
    // The notification uses the user-provided value (invalid) even though fallback applied
    expect(ctx.ui.notify).toHaveBeenCalledWith('Saved thinking = invalid', 'info');
  });

  it('handles setDefaultModel rejection', async () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    ctx = { hasUI: true, cwd: '/repo', ui: { custom: vi.fn(), notify: vi.fn() } } as any;

    mockSettingsManager.getDefaultModel.mockReturnValue('');
    mockSettingsManager.getDefaultThinkingLevel.mockReturnValue('medium');
    mockSettingsManager.setDefaultModel.mockImplementation(() => {
      throw new Error('Disk full');
    });

    await handler('', ctx);
    renderFn = ctx.ui.custom.mock.calls[0][0] as Function;
    tui = { requestRender: vi.fn() };
    renderFn(tui, createMockTheme(), {}, vi.fn());

    const onEdit = capturedSettingsListArgs[3];
    await onEdit('model', 'bad');

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Failed to save model'), 'error');
  });

  it('renders UI with unset model', async () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    ctx = { hasUI: true, cwd: '/repo', ui: { custom: vi.fn(), notify: vi.fn() } } as any;

    mockSettingsManager.getDefaultModel.mockReturnValue('');
    mockSettingsManager.getDefaultThinkingLevel.mockReturnValue('medium');

    await handler('', ctx);
    expect(ctx.ui.custom).toHaveBeenCalled();
    renderFn = ctx.ui.custom.mock.calls[0][0] as Function;
    renderFn(tui = { requestRender: vi.fn() }, createMockTheme(), {}, vi.fn());

    const items = capturedSettingsListArgs[0];
    expect(items[0].currentValue).toBe('<unset>');
  });
});
