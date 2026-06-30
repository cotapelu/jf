import { describe, it, expect } from 'vitest';
import { getTimeTool } from '../../tools/time/index.js';
import type { AgentToolResult } from '@earendil-works/pi-coding-agent';

describe('GetTimeTool', () => {
  it('should return time in UTC by default', async () => {
    const result = await getTimeTool.execute('call', {}) as AgentToolResult<unknown>;
    expect(result.content[0].text).toMatch(/Current time in UTC:/);
    expect(result.content[0].text).toMatch(/\d{4}-\d{2}-\d{2}/); // date format
  });

  it('should accept custom timezone', async () => {
    const result = await getTimeTool.execute('call', { timezone: 'America/New_York' }) as AgentToolResult<unknown>;
    expect(result.content[0].text).toContain('Current time in America/New_York');
  });

  it('should handle invalid timezone with error', async () => {
    const result = await getTimeTool.execute('call', { timezone: 'Invalid/Zone' }) as AgentToolResult<unknown>;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Error:/);
  });
});
