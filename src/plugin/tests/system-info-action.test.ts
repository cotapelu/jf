#!/usr/bin/env node

/**
 * Tests for system-info-action
 */

import { describe, it, expect } from 'vitest';
import { systemInfoAction } from '../extensions/tools/actions/system-info-action';

describe('system-info-action', () => {
  it('should return system info with expected keys', async () => {
    const result = await systemInfoAction.execute(); // no args
    const info = result.details;
    expect(info).toHaveProperty('platform');
    expect(info).toHaveProperty('arch');
    expect(info).toHaveProperty('osRelease');
    expect(info).toHaveProperty('nodeVersion');
    expect(info).toHaveProperty('uptime');
    expect(info).toHaveProperty('totalMemoryMB');
    expect(info).toHaveProperty('freeMemoryMB');
    expect(info).toHaveProperty('cpuCores');
    expect(info).toHaveProperty('cpuModel');
  });

  it('should have empty schema', () => {
    const schema = systemInfoAction.getParameters();
    expect(schema.type).toBe('object');
    expect(schema.properties).toEqual({});
  });
});
