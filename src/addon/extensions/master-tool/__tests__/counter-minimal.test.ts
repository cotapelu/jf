import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRegistry } from '../command-registry.js';

describe('Counter Minimal', () => {
  let registry: CommandRegistry;
  let ctx: any;

  beforeEach(async () => {
    registry = new CommandRegistry();
    await registry.initialize();
    ctx = { cwd: '/tmp', exec: async () => ({ code: 0, stdout: '', stderr: '' }) } as any;
  });

  it('gets initial value', async () => {
    const result = await registry.execute('demo.counter', { action: 'get' }, {
      toolCallId: '1',
      signal: undefined,
      onUpdate: undefined,
      ctx,
      maxOutputSize: 1024 * 1024
    });
    expect(result.isError).toBe(false);
    const text = result.content.find(c => c.type === 'text')?.text || '';
    expect(text).toContain('0');
  });
});
