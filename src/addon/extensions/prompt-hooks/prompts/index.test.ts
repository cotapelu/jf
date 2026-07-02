import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('prompts registry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should return two built-in prompts by default', async () => {
    const { getAllBuiltinPrompts } = await import('./index.js');
    const prompts = getAllBuiltinPrompts();
    expect(prompts).toHaveLength(2);
    const names = prompts.map(p => p.name);
    expect(names).toContain('jf');
    expect(names).toContain('review');
  });

  it('should get built-in prompt by name', async () => {
    const { getBuiltinPrompt } = await import('./index.js');
    const p = getBuiltinPrompt('jf');
    expect(p).toBeDefined();
    expect(p.name).toBe('jf');
  });

  it('should return undefined for unknown prompt', async () => {
    const { getBuiltinPrompt } = await import('./index.js');
    expect(getBuiltinPrompt('unknown')).toBeUndefined();
  });

  it('should check existence of prompt', async () => {
    const { hasBuiltinPrompt } = await import('./index.js');
    expect(hasBuiltinPrompt('jf')).toBe(true);
    expect(hasBuiltinPrompt('nonexistent')).toBe(false);
  });

  it('should register new prompt', async () => {
    const { registerBuiltinPrompt, getAllBuiltinPrompts } = await import('./index.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newPrompt = { name: 'test-prompt', content: 'test' } as any;
    registerBuiltinPrompt(newPrompt);
    const after = getAllBuiltinPrompts();
    expect(after.some(p => p.name === 'test-prompt')).toBe(true);
  });
});
