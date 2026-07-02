import { describe, it, expect } from 'vitest';
import { calcAction } from '../../extensions/tools/actions/calc-action.js';

describe('calcAction', () => {
  it('evaluates valid expression', async () => {
    const result = await calcAction.execute({ expression: '2 + 3 * 4' });
    expect(result.content[0].text).toBe('2 + 3 * 4 = 14');
    expect((result.details as any).result).toBe(14);
  });

  it('evaluates simple addition', async () => {
    const result = await calcAction.execute({ expression: '1+2' });
    expect(result.content[0].text).toBe('1+2 = 3');
    expect((result.details as any).result).toBe(3);
  });

  it('handles parentheses', async () => {
    const result = await calcAction.execute({ expression: '(2+3)*4' });
    expect(result.content[0].text).toBe('(2+3)*4 = 20');
    expect((result.details as any).result).toBe(20);
  });

  it('handles decimal numbers', async () => {
    const result = await calcAction.execute({ expression: '3.5 * 2' });
    expect(result.content[0].text).toBe('3.5 * 2 = 7');
    expect((result.details as any).result).toBe(7);
  });

  it('throws on invalid characters', async () => {
    await expect(calcAction.execute({ expression: '2 + x' })).rejects.toThrow('Invalid expression');
  });

  it('throws on division by zero (Infinity)', async () => {
    await expect(calcAction.execute({ expression: '1/0' })).rejects.toThrow('Invalid calculation result');
  });

  it('throws on 0/0 (NaN)', async () => {
    await expect(calcAction.execute({ expression: '0/0' })).rejects.toThrow('Invalid calculation result');
  });
});
