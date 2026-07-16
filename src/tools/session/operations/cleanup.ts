import type { MultiSessionManager } from '../manager.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../../../logger.js';

async function listSessionFiles(sessionDir: string): Promise<Array<{ file: string; mtime: Date }>> {
  const entries = await fs.readdir(sessionDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
    .map((e) => path.join(sessionDir, e.name));
  const stats = await Promise.all(
    files.map(async (file) => {
      const stat = await fs.stat(file);
      return { file, mtime: stat.mtime };
    })
  );
  return stats;
}

function computeDeletionCandidates(
  fileStats: Array<{ file: string; mtime: Date }>,
  params: { olderThanDays?: number; keepCount?: number }
): string[] {
  const now = Date.now();
  const olderThanMs = (params.olderThanDays ?? 30) * 24 * 60 * 60 * 1000;
  const cutoff = now - olderThanMs;
  const keep = params.keepCount ?? 100;
  fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
  const toDelete: string[] = [];
  for (let i = 0; i < fileStats.length; i++) {
    if (fileStats.length - i > keep) {
      toDelete.push(fileStats[i].file);
    } else if (fileStats[i].mtime.getTime() < cutoff) {
      toDelete.push(fileStats[i].file);
    }
  }
  return [...new Set(toDelete)];
}

async function deleteFiles(files: string[], dryRun: boolean, mgr: MultiSessionManager): Promise<number> {
  if (dryRun) return files.length;
  await Promise.all(
    files.map((file) => fs.unlink(file).catch((err) => logger.error(`Failed to delete ${file}: ${err}`)))
  );
  (mgr as any).recordCleanup?.(files.length);
  return files.length;
}

export async function operationCleanup(
  mgr: MultiSessionManager,
  params: { olderThanDays?: number; keepCount?: number; dryRun?: boolean }
) {
  const runtime = mgr.getRuntime();
  const services = (runtime as any).services;
  const sessionManager = services?.sessionManager;
  if (!sessionManager) throw new Error('Session manager not available');
  const sessionDir = sessionManager.dir || sessionManager.sessionDir;
  if (!sessionDir) throw new Error('Cannot determine session directory');

  const fileStats = await listSessionFiles(sessionDir);
  const toDelete = computeDeletionCandidates(fileStats, params);
  const deletedCount = await deleteFiles(toDelete, params.dryRun ?? false, mgr);

  const dry = params.dryRun === true;
  const content = dry
    ? `🧹 Cleanup dry-run: would delete ${deletedCount} session files (older than ${params.olderThanDays} days, keep most recent ${params.keepCount ?? 100}).`
    : `✅ Cleanup complete: deleted ${deletedCount} session files.`;
  return {
    content: [{ type: 'text', text: content }],
    details: {
      operation: 'cleanup',
      dryRun: dry,
      filesConsidered: fileStats.length,
      ...(dry
        ? { filesToDelete: deletedCount, deletionCandidates: toDelete.map((f) => path.basename(f)) }
        : { filesDeleted: deletedCount, deletedFiles: toDelete.map((f) => path.basename(f)) }),
    },
  };
}
