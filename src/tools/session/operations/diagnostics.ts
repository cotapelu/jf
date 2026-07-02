import type { MultiSessionManager } from '../manager.js';

export function operationDiagnostics(mgr: MultiSessionManager) {
  const diag = mgr.getDiagnostics();
  const registryState = JSON.stringify(mgr.exportMetadata(), null, 2);

  // Collect system metrics (extended diagnostics)
  const system = {
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
  };

  return {
    content: [
      {
        type: 'text',
        text:
          `🔍 Diagnostics:\n` +
          `Total Sessions: ${diag.totalSessions}\n` +
          `Active: ${diag.activeSessionId}\n` +
          `Root: ${diag.rootSessionId}\n` +
          `Children: ${diag.childCount}\n` +
          `Disposed: ${diag.disposedCount}\n` +
          `History Size: ${diag.historySize}\n` +
          `System Uptime: ${system.uptime.toFixed(2)}s\n` +
          `Node: ${system.nodeVersion} (${system.platform})\n` +
          `Memory (RSS): ${(system.memory.rss / 1024 / 1024).toFixed(2)} MB\n\n` +
          `Registry State:\n${registryState}`,
      },
    ],
    details: {
      operation: 'diagnostics',
      ...diag,
      system,
      registryExport: JSON.parse(registryState),
    },
  };
}
