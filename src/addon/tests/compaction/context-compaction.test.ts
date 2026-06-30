/**
 * Context Compaction Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the compaction algorithm before importing the tool
vi.mock('../../tools/compaction/algorithm.js', () => ({
  compactSession: vi.fn(),
}));

import { compactContextTool } from '../../tools/compaction/index.js';
import { compactSession } from '../../tools/compaction/algorithm.js';

describe('Context Compaction Tool', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = { cwd: '.' };
  });

  it('should have correct metadata', () => {
    expect(compactContextTool).toBeDefined();
    expect(compactContextTool.name).toBe('session.compact');
    expect(compactContextTool.description).toContain('token');
  });

  it('should compact session and return summary', async () => {
    vi.mocked(compactSession).mockResolvedValue({
      originalTokens: 5000,
      compactedTokens: 3500,
      summary: 'Summary of older messages...',
      removedMessages: 10,
    });
    const result: any = await compactContextTool.execute('call', { messages: [{ role: 'user', content: 'hello' }] }, undefined, undefined, mockCtx);
    expect(result.details?.status).toBe('success');
    expect(result.content[0].text).toContain('Summary');
  });

  it('should pass options to algorithm', async () => {
    vi.mocked(compactSession).mockResolvedValue({
      originalTokens: 8000,
      compactedTokens: 2000,
      summary: 'Compact summary',
      removedMessages: 20,
    });
    await compactContextTool.execute('call', { messages: [{ role: 'user', content: 'x' }], maxTokens: 2000, preserveRecent: false, strategy: 'sliding-window' }, undefined, undefined, mockCtx);
    expect(compactSession).toHaveBeenCalledWith([{ role: 'user', content: 'x' }], { maxTokens: 2000, preserveRecent: false, strategy: 'sliding-window' });
  });

  it('should handle algorithm errors', async () => {
    vi.mocked(compactSession).mockRejectedValue(new Error('Session too large to compact'));
    const result: any = await compactContextTool.execute('call', { messages: [{ role: 'user', content: 'x' }] }, undefined, undefined, mockCtx);
    expect(result.details?.status).toBe('error');
    expect(result.isError).toBe(true);
  });

  it('should require messages parameter', async () => {
    const result: any = await compactContextTool.execute('call', {}, undefined, undefined, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('messages array is required');
  });
});
