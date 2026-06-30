import { vi, describe, it, expect } from 'vitest';

describe('Codebase Indexer Error Handling', () => {
  it('should return error when scanCodebase throws', async () => {
    vi.doMock('../../tools/indexer/ast-scanner.js', () => ({
      scanCodebase: vi.fn().mockRejectedValue(new Error('scan failure')),
    }));
    vi.resetModules();
    const { codebaseIndexTool } = await import('../../tools/indexer/index.js');
    const result = await codebaseIndexTool.execute('call', { query: 'test' }, undefined, undefined, { cwd: process.cwd() });
    expect(result.details?.status).toBe('error');
    expect(result.content[0].text).toContain('Error: scan failure');
    vi.unmock('../../tools/indexer/ast-scanner.js');
  });
});
