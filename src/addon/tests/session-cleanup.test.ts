import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { operationCleanup } from '../tools/session/operations/cleanup.js';
import type { MultiSessionManager } from '../tools/session/manager.js';
import type { AgentToolResult } from '@earendil-works/pi-coding-agent';

function createMockManager(dir: string): MultiSessionManager {
  return {
    getRuntime: () => ({
      services: { sessionManager: { dir } }
    })
  } as unknown as MultiSessionManager;
}

describe('operationCleanup (integration)', () => {
  let tempDir: string;
  let mgr: MultiSessionManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sessions-'));
    mgr = createMockManager(tempDir);
  });

  afterEach(async () => {
    try {
      const files = await fs.readdir(tempDir);
      await Promise.all(files.map(f => fs.unlink(path.join(tempDir, f))));
    } catch {
      // ignore
    }
    try {
      await fs.rmdir(tempDir);
    } catch {
      // ignore
    }
  });

  it('should dry-run and report files to delete based on age', async () => {
    const oldFile1 = path.join(tempDir, 'old1.jsonl');
    const oldFile2 = path.join(tempDir, 'old2.jsonl');
    const recentFile = path.join(tempDir, 'recent.jsonl');

    await Promise.all([
      fs.writeFile(oldFile1, ''),
      fs.writeFile(oldFile2, ''),
      fs.writeFile(recentFile, ''),
    ]);

    // Set mtime 40 days ago for old files
    const oldTime = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await fs.utimes(oldFile1, oldTime, oldTime);
    await fs.utimes(oldFile2, oldTime, oldTime);
    // recentFile mtime remains now

    const result = await operationCleanup(mgr, { olderThanDays: 30, keepCount: 100, dryRun: true });

    const anyResult = result as AgentToolResult<unknown>;
    expect(anyResult.isError).toBeUndefined();
    expect(anyResult.details?.operation).toBe('cleanup');
    expect(anyResult.details?.dryRun).toBe(true);
    expect(anyResult.details?.filesConsidered).toBe(3);
    expect(anyResult.details?.filesToDelete).toBe(2);
  });

  it('should delete files when dryRun=false', async () => {
    const oldFile = path.join(tempDir, 'old.jsonl');
    const recentFile = path.join(tempDir, 'recent.jsonl');

    await Promise.all([
      fs.writeFile(oldFile, ''),
      fs.writeFile(recentFile, ''),
    ]);

    const oldTime = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await fs.utimes(oldFile, oldTime, oldTime);

    const result = await operationCleanup(mgr, { olderThanDays: 30, keepCount: 100, dryRun: false });

    const anyResult = result as AgentToolResult<unknown>;
    expect(anyResult.isError).toBeUndefined();
    expect(anyResult.details?.filesDeleted).toBe(1);

    // Verify file actually removed
    const exists = await fs.access(oldFile).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it('should respect keepCount and delete oldest when too many files', async () => {
    // Create 5 files, all recent, but keepCount=2 => delete 3 oldest
    const files: string[] = [];
    for (let i = 0; i < 5; i++) {
      const f = path.join(tempDir, `file${i}.jsonl`);
      files.push(f);
      await fs.writeFile(f, '');
    }
    // Set mtime with slight differences: older for first three
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      const t = new Date(now - (i + 1) * 1000); // older seconds apart
      await fs.utimes(files[i], t, t);
    }
    // Last two are recent (now)
    // run dry-run with effectively no age limit (olderThanDays very large)
    const result = await operationCleanup(mgr, { olderThanDays: 9999, keepCount: 2, dryRun: true });
    const anyResult = result as AgentToolResult<unknown>;
    expect(anyResult.details?.filesToDelete).toBe(3);
    expect(anyResult.details?.deletionCandidates).toContain(path.basename(files[0]));
    expect(anyResult.details?.deletionCandidates).toContain(path.basename(files[1]));
    expect(anyResult.details?.deletionCandidates).toContain(path.basename(files[2]));
  });

  it('should throw when session manager not available', async () => {
    const badMgr = {
      getRuntime: () => ({ services: {} })
    } as unknown as MultiSessionManager;
    await expect(operationCleanup(badMgr, {})).rejects.toThrow('Session manager not available');
  });
});
