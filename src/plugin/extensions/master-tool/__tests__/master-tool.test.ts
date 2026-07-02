#!/usr/bin/env node
/**
 * Master Tool - Comprehensive Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rmdir } from 'node:fs/promises';
import os from 'node:os';
import { Text } from '@earendil-works/pi-tui';
import { createMasterTool, getRegistry, resetRegistry } from '../master-tool.js';

function createMockTheme() {
  return {
    fg: (color: string, text: string) => text,
    bg: () => '',
    bold: (text: string) => `<b>${text}</b>`,
    dim: () => '',
    underline: () => '',
    inverse: () => '',
    hex: () => ''
  };
}

describe('Master Tool - execute()', () => {
  let tempDir: string;
  let mockCtx: any;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(os.tmpdir(), 'piclaw-mt-'));
    resetRegistry();
    mockCtx = {
      cwd: tempDir,
      exec: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      config: {},
      session: {},
      cache: new Map()
    };
  });

  afterEach(async () => {
    try { await rmdir(tempDir, { recursive: true }).catch(() => {}); } catch (e) {}
    resetRegistry();
  });

  describe('tool definition', () => {
    it('should have correct name and description', () => {
      const tool = createMasterTool();
      expect(tool.name).toBe('plugin.master_tool');
      expect(tool.label).toBe('Master Tool');
      expect(tool.description).toContain('Unified access');
    });

    it('should have required parameters schema', () => {
      const tool = createMasterTool();
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties.command.type).toBe('string');
      expect(tool.parameters.properties.args.type).toBe('object');
      expect(tool.parameters.required).toEqual(['command', 'args']);
    });
  });

  describe('input validation', () => {
    it('returns error if command missing', async () => {
      const tool = createMasterTool();
      const result = await tool.execute('id', { args: {} } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('missing_command');
    });

    it('returns error if command not string', async () => {
      const tool = createMasterTool();
      const result = await tool.execute('id', { command: 123 } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('missing_command');
    });
  });

  describe('initialization errors', () => {
    it('handles registry ensureInitialized failure', async () => {
      const tool = createMasterTool();
      const registry = getRegistry();
      vi.spyOn(registry, 'ensureInitialized').mockRejectedValue(new Error('load fail'));

      const result = await tool.execute('id', { command: 'list', args: {} } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('registry_init_failed');
    });
  });

  describe('meta-commands', () => {
    it('handles "list"', async () => {
      const tool = createMasterTool();
      const result = await tool.execute('id', { command: 'list', args: {} } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Available Commands');
    });

    it('handles "list.grep"', async () => {
      const tool = createMasterTool();
      const result = await tool.execute('id', { command: 'list.grep', args: { category: 'git' } } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('git');
    });

    it('handles "help" missing command arg', async () => {
      const tool = createMasterTool();
      const result = await tool.execute('id', { command: 'help', args: {} } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('missing_command');
    });

    it('handles "help" unknown command', async () => {
      const tool = createMasterTool();
      const result = await tool.execute('id', { command: 'help', args: { command: 'unknown' } } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('command_not_found');
    });

    it('handles "stats"', async () => {
      const tool = createMasterTool();
      const result = await tool.execute('id', { command: 'stats', args: {} } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Statistics');
    });

    it('handles "reload"', async () => {
      const tool = createMasterTool();
      const result = await tool.execute('id', { command: 'reload', args: {} } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('cleared');
    });
  });

  describe('normal command execution', () => {
    it('forwards to registry and transforms result', async () => {
      const tool = createMasterTool();
      const registry = getRegistry();
      const spy = vi.spyOn(registry, 'execute').mockResolvedValue({
        content: [{ type: 'text', text: 'cmd output' }],
        details: { command: 'test.cmd', code: 0, data: { ok: true } },
        isError: false
      });

      const result = await tool.execute('id', { command: 'test.cmd', args: {} } as any, undefined, undefined, mockCtx);

      expect(result.content).toEqual([{ type: 'text', text: 'cmd output' }]);
      expect(result.details.command).toBe('test.cmd');
      expect(result.isError).toBe(false);
    });

    it('propagates registry error', async () => {
      const tool = createMasterTool();
      const registry = getRegistry();
      vi.spyOn(registry, 'execute').mockResolvedValue({
        content: [],
        details: { command: 'fail.cmd', error: 'failed' },
        isError: true
      });

      const result = await tool.execute('id', { command: 'fail.cmd', args: {} } as any, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.details.error).toBe('failed');
    });
  });
});

describe('Master Tool - renderCall()', () => {
  it('includes command name in output', () => {
    const tool = createMasterTool();
    const theme = createMockTheme();
    const result = tool.renderCall({ command: 'git.status', args: {} }, theme);
    expect(result instanceof Text).toBe(true);
    expect(result.text).toContain('master_tool');
    expect(result.text).toContain('git.status');
  });
});

describe('Master Tool - renderResult()', () => {
  const theme = createMockTheme();

  it('shows executing spinner when partial', () => {
    const tool = createMasterTool();
    const result = tool.renderResult(
      { content: [], details: { command: 'git.status' }, isError: false },
      { expanded: false, isPartial: true },
      theme
    );
    expect(result.text).toContain('Executing');
    expect(result.text).toContain('git.status');
  });

  it('shows error with command and stderr', () => {
    const tool = createMasterTool();
    const result = tool.renderResult(
      { content: [], details: { command: 'git.status', error: 'git not found' }, isError: true },
      { expanded: false, isPartial: false },
      theme
    );
    expect(result.text).toContain('git.status failed');
    expect(result.text).toContain('git not found');
  });

  it('shows success with exit code and duration', () => {
    const tool = createMasterTool();
    const result = tool.renderResult(
      { content: [{ type: 'text', text: 'Output' }], details: { command: 'dev.test', code: 0, duration: 1234 }, isError: false },
      { expanded: false, isPartial: false },
      theme
    );
    expect(result.text).toContain('completed (exit 0)');
    expect(result.text).toContain('1234ms');
  });

  it('truncates long stdout when not expanded', () => {
    const tool = createMasterTool();
    const longLines = Array(20).fill('line').join('\n');
    const result = tool.renderResult(
      { content: [{ type: 'text', text: longLines }], details: { command: 'test', code: 0 }, isError: false },
      { expanded: false, isPartial: false },
      theme
    );
    expect(result.text).toContain('... and');
  });

  it('does not truncate when expanded', () => {
    const tool = createMasterTool();
    const lines = Array(20).fill('line').join('\n');
    const result = tool.renderResult(
      { content: [{ type: 'text', text: lines }], details: { command: 'test', code: 0 }, isError: false },
      { expanded: true, isPartial: false },
      theme
    );
    expect(result.text).not.toContain('... and');
  });

  it('falls back to stdout when no details', () => {
    const tool = createMasterTool();
    const result = tool.renderResult(
      { content: [{ type: 'text', text: 'Plain output' }], details: {}, isError: false },
      { expanded: false, isPartial: false },
      theme
    );
    expect(result.text).toBe('Plain output');
  });
});

describe('Master Tool - integration', () => {
  it('lists commands via list meta-command', async () => {
    resetRegistry();
    const tool = createMasterTool();
    const tempDir = await mkdtemp(join(os.tmpdir(), 'piclaw-integ-'));
    const ctx = { cwd: tempDir, exec: async () => ({ code: 0, stdout: '', stderr: '' }) } as any;

    const result = await tool.execute('id', { command: 'list', args: {} } as any, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Available Commands');

    await rmdir(tempDir, { recursive: true }).catch(() => {});
    resetRegistry();
  });

  it('handles non-existent command', async () => {
    resetRegistry();
    const tool = createMasterTool();
    const tempDir = await mkdtemp(join(os.tmpdir(), 'piclaw-integ-'));
    const ctx = { cwd: tempDir, exec: async () => ({ code: 0, stdout: '', stderr: '' }) } as any;

    const result = await tool.execute('id', { command: 'unknown.cmd', args: {} } as any, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    // Error message includes command not found in content or details
    expect(result.content[0].text || '').toContain('not found');

    await rmdir(tempDir, { recursive: true }).catch(() => {});
    resetRegistry();
  });
});
