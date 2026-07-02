import { describe, it, expect } from 'vitest';
import { execute } from '../info.js';

describe('system.info (detailed)', () => {
  it('should include detailed system information when detailed flag is true', async () => {
    const result = await execute({ detailed: true }, process.cwd(), undefined, undefined);
    expect(result.code).toBe(0);
    const data = result.data as any;
    // Basic fields always present
    expect(data).toHaveProperty('platform');
    expect(data).toHaveProperty('arch');
    expect(data).toHaveProperty('hostname');
    // Detailed fields
    expect(data).toHaveProperty('cpu');
    expect(data.cpu).toHaveProperty('model');
    expect(data.cpu).toHaveProperty('cores');
    expect(data).toHaveProperty('memory');
    expect(data.memory).toHaveProperty('totalMB');
    expect(data.memory).toHaveProperty('freeMB');
    expect(data.memory).toHaveProperty('usedMB');
    expect(data.memory).toHaveProperty('usagePercent');
    expect(data).toHaveProperty('node');
    expect(data.node).toHaveProperty('version');
    expect(data.node).toHaveProperty('uptime');
  });
});
