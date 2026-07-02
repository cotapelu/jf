#!/usr/bin/env node
/**
 * System Info Command - Unit Tests
 *
 * Tests execute() and renderResult() branches without mocking core os module.
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rmdir } from 'node:fs/promises';
import os from 'node:os';
import { Text } from '@earendil-works/pi-tui';
import { execute, renderResult } from '../commands/system/info.js';

function createMockTheme() {
  return {
    fg: (color: string, text: string) => text,
    bg: () => '',
    bold: () => '',
    dim: () => '',
    underline: () => '',
    inverse: () => '',
    hex: () => ''
  };
}

describe('System Info Command - execute()', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(os.tmpdir(), 'piclaw-system-'));
  });

  afterEach(async () => {
    try {
      await rmdir(tempDir, { recursive: true }).catch(() => {});
    } catch (e) {}
  });

  const makeCtx = () => ({
    toolCallId: 'test-1',
    signal: undefined,
    onUpdate: undefined,
    ctx: { cwd: tempDir, exec: async () => ({ code: 0, stdout: '', stderr: '' }) },
    maxOutputSize: 1024 * 1024
  } as any);

  describe('successful execution', () => {
    it('should return system info with default args', async () => {
      const result = await execute({}, tempDir, undefined, makeCtx());
      expect(result.code).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.data).toBeDefined();
      // Verify fields are populated from actual os
      expect(result.data.platform).toBe(os.platform());
      expect(result.data.arch).toBe(os.arch());
      expect(result.data.hostname).toBe(os.hostname());
      expect(result.data.cpu.cores).toBeGreaterThan(0);
      expect(result.data.memory.totalMB).toBeGreaterThan(0);
      expect(result.data.node.version).toBe(process.version);
      expect(result.data.node.uptime).toBeGreaterThanOrEqual(0);
      // Output contains expected sections
      expect(result.stdout).toContain('System Information');
      expect(result.stdout).toContain('OS:');
      expect(result.stdout).toContain('CPU:');
      expect(result.stdout).toContain('Memory:');
      expect(result.stdout).toContain('Node:');
      expect(result.stdout).toContain('Uptime:');
    });

    it('should include detailed memory info when detailed=true', async () => {
      const result = await execute({ detailed: true }, tempDir, undefined, makeCtx());
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Detailed:');
      expect(result.stdout).toContain('Total memory');
      expect(result.stdout).toContain('Free memory');
      expect(result.stdout).toContain('Used memory');
    });
  });
});

describe('System Info Command - renderResult()', () => {
  const mockTheme = createMockTheme();

  const mockInfo = {
    platform: 'linux',
    arch: 'x64',
    hostname: 'server',
    cpu: { model: 'Test CPU', cores: 4 },
    memory: { totalMB: 8000, freeMB: 4000, usedMB: 4000, usagePercent: 50.0 },
    node: { version: 'v20.0.0', uptime: 3661 } // ~1h 1m
  };

  describe('success rendering', () => {
    it('should render basic system info from data', () => {
      const raw = { code: 0, stdout: '', stderr: '', data: mockInfo };
      const result = renderResult(raw, {}, mockTheme);
      expect(result instanceof Text).toBe(true);
      expect(result.text).toContain('System Info');
      expect(result.text).toContain(mockInfo.cpu.model);
      expect(result.text).toContain(`${mockInfo.cpu.cores} cores`);
      expect(result.text).toContain('linux x64');
      expect(result.text).toContain('v20.0.0');
    });

    it('should render memory bar and percent', () => {
      const raw = { code: 0, stdout: '', stderr: '', data: mockInfo };
      const result = renderResult(raw, {}, mockTheme);
      // Bar characters: filled (█) and empty (░)
      expect(result.text).toMatch(/█+.*░+/);
      expect(result.text).toContain('50%');
    });

    it('should render uptime in hours/minutes format', () => {
      const raw = { code: 0, stdout: '', stderr: '', data: mockInfo };
      const result = renderResult(raw, {}, mockTheme);
      expect(result.text).toContain('1h 1m');
    });
  });

  describe('fallback rendering', () => {
    it('should render stdout when data is undefined', () => {
      const raw = { code: 0, stdout: 'Plain output line', stderr: '', data: undefined };
      const result = renderResult(raw, {}, mockTheme);
      expect(result.text).toBe('Plain output line');
    });
  });

  describe('error rendering', () => {
    it('should render stderr when code != 0', () => {
      const raw = { code: 1, stdout: '', stderr: 'Something went wrong', data: undefined };
      const result = renderResult(raw, {}, mockTheme);
      expect(result instanceof Text).toBe(true);
      expect(result.text).toContain('❌');
      expect(result.text).toContain('Something went wrong');
    });
  });
});
