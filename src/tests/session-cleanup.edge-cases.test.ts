import { describe, it, expect, vi, beforeEach } from 'vitest';
import { operationCleanup } from '../tools/session/operations/cleanup.js';
import type { MultiSessionManager } from '../tools/session/manager.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Mock logger
vi.mock('../../../logger.js', () => ({
  logger: { error: vi.fn() }
}));

// Ensure fs methods are mocked via vi.mock at top-level separately if needed.
// We'll manually mock in each test using vi.spyOn

function mockManager(overrides: Partial<MultiSessionManager> = {}): MultiSessionManager {
  return {
    getRuntime: () => ({
      services: { sessionManager: { dir: '/session' } }
    }),
    recordCleanup: vi.fn(),
    ...overrides
  } as any as MultiSessionManager;
}

describe('operationCleanup - edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw when sessionManager not available', async () => {
    const mgr = {
      getRuntime: () => ({ services: {} })
    } as any as MultiSessionManager;

    await expect(operationCleanup(mgr, {}))
      .rejects.toThrow('Session manager not available');
  });

  it('should throw when sessionDir not found', async () => {
    const mgr = {
      getRuntime: () => ({
        services: { sessionManager: {} }
      })
    } as any as MultiSessionManager;

    await expect(operationCleanup(mgr, {}))
      .rejects.toThrow('Cannot determine session directory');
  });

  it('should use default olderThanDays=30 when not provided', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue([] as any);
    vi.spyOn(fs, 'stat').mockResolvedValue({ mtime: new Date(), size: 0 } as any);

    const mgr = mockManager();

    const result = await operationCleanup(mgr, { dryRun: true });
    expect(result.details.filesConsidered).toBe(0);
    expect(result.details.filesToDelete).toBe(0);
  });

  it('should use default keepCount=100 when not provided', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue([
      { isFile: () => true, name: 'f1.jsonl' },
      { isFile: () => true, name: 'f2.jsonl' },
    ] as any);
    const oldTime = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    vi.spyOn(fs, 'stat').mockResolvedValue({ mtime: oldTime, size: 100 } as any);

    const mgr = mockManager();

    const result = await operationCleanup(mgr, { olderThanDays: 30, dryRun: true });
    // Both files older than 30 days, so would be deleted
    expect(result.details.filesToDelete).toBe(2);
  });

  it('should record cleanup stats only when not dryRun', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue([
      { isFile: () => true, name: 'f1.jsonl' },
    ] as any);
    const oldTime = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    vi.spyOn(fs, 'stat').mockResolvedValue({ mtime: oldTime, size: 100 } as any);

    const mgr = mockManager();
    const recordSpy = vi.spyOn(mgr as any, 'recordCleanup');

    // dryRun = true -> should NOT call recordCleanup
    await operationCleanup(mgr, { dryRun: true });
    expect(recordSpy).not.toHaveBeenCalled();

    // dryRun = false -> should call recordCleanup
    await operationCleanup(mgr, { dryRun: false });
    expect(recordSpy).toHaveBeenCalledWith(1);
  });

  it('should handle empty directory', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue([] as any);

    const mgr = mockManager();
    const result = await operationCleanup(mgr, {});
    expect(result.details.filesConsidered).toBe(0);
    expect(result.details.filesDeleted).toBe(0);
  });

  it('should filter only .jsonl files', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue([
      { isFile: () => true, name: 'a.jsonl' },
      { isFile: () => true, name: 'b.txt' },
      { isFile: () => true, name: 'c.jsonl' },
    ] as any);
    const oldTime = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    vi.spyOn(fs, 'stat').mockResolvedValue({ mtime: oldTime, size: 100 } as any);

    const mgr = mockManager();
    const result = await operationCleanup(mgr, { olderThanDays: 30, dryRun: true });
    // Only .jsonl files considered
    expect(result.details.filesConsidered).toBe(2);
    expect(result.details.filesToDelete).toBe(2); // two old .jsonl files
  });
});
