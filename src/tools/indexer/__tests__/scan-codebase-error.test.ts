import { describe, it, expect } from 'vitest';
import { scanCodebase } from '../ast-scanner.js';

describe('scanCodebase error handling', () => {
  it('should return empty matches when cwd does not exist', async () => {
    const result = await scanCodebase('/nonexistent-cwd-12345', {
      query: 'test',
    });
    expect(result.matches).toEqual([]);
  });
});
