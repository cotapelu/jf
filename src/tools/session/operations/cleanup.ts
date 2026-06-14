import type { MultiSessionManager } from '../manager.js';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Cleanup old session files on disk
 *
 * Parameters:
 * - olderThanDays: delete files older than N days (default: 30)
 * - keepCount: keep at least N most recent files (default: 100)
 * - dryRun: if true, only report what would be deleted (default: false)
 */
export async function operationCleanup(
  mgr: MultiSessionManager,
  params: {
    olderThanDays?: number;
    keepCount?: number;
    dryRun?: boolean;
  }
) {
  const runtime = mgr.getRuntime();
  const services = (runtime as any).services; // AgentSessionServices
  const sessionManager = services?.sessionManager;
  if (!sessionManager) {
    throw new Error('Session manager not available');
  }

  // Get session directory path from sessionManager internals.
  // Pi SDK's SessionManager has a `dir` property.
  const sessionDir = sessionManager.dir || sessionManager.sessionDir;
  if (!sessionDir) {
    throw new Error('Cannot determine session directory');
  }

  // Read all .jsonl files
  const entries = await fs.readdir(sessionDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
    .map((e) => path.join(sessionDir, e.name));

  // Get stats for each file
  const fileStats = await Promise.all(
    files.map(async (file) => {
      const stat = await fs.stat(file);
      return { file, mtime: stat.mtime, size: stat.size };
    })
  );

  // Sort by mtime ascending (oldest first)
  fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

  const now = Date.now();
  const olderThanMs = (params.olderThanDays ?? 30) * 24 * 60 * 60 * 1000;
  const cutoff = now - olderThanMs;

  const toDelete: string[] = [];
  const keep = params.keepCount ?? 100;

  // Collect files older than cutoff OR beyond keepCount (oldest ones)
  for (let i = 0; i < fileStats.length; i++) {
    const { file, mtime } = fileStats[i];
    if (fileStats.length - i > keep) {
      toDelete.push(file);
    } else if (mtime.getTime() < cutoff) {
      toDelete.push(file);
    }
  }

  // Deduplicate (some may satisfy both)
  const uniqueDelete = [...new Set(toDelete)];

  if (params.dryRun) {
    // No deletion
    return {
      content: [
        {
          type: 'text',
          text: `🧹 Cleanup dry-run: would delete ${uniqueDelete.length} session files (older than ${params.olderThanDays} days, keep most recent ${keep}).`,
        },
      ],
      details: {
        operation: 'cleanup',
        dryRun: true,
        filesConsidered: fileStats.length,
        filesToDelete: uniqueDelete.length,
        deletionCandidates: uniqueDelete.map((f) => path.basename(f)),
      },
    };
  }

  // Actually delete
  await Promise.all(uniqueDelete.map((file) => fs.unlink(file).catch((err) => console.error(`Failed to delete ${file}:`, err))));

  return {
    content: [
      {
        type: 'text',
        text: `✅ Cleanup complete: deleted ${uniqueDelete.length} session files.`,
      },
    ],
    details: {
      operation: 'cleanup',
      dryRun: false,
      filesConsidered: fileStats.length,
      filesDeleted: uniqueDelete.length,
      deletedFiles: uniqueDelete.map((f) => path.basename(f)),
    },
  };
}
