import type { MultiSessionManager } from '../manager.js';

export function operationDiagnostics(mgr: MultiSessionManager) {
  const diag = mgr.getDiagnostics();
  const registryState = JSON.stringify(mgr.exportMetadata(), null, 2);

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
          `History Size: ${diag.historySize}\n\n` +
          `Registry State:\n${registryState}`,
      },
    ],
    details: {
      operation: 'diagnostics',
      ...diag,
      registryExport: JSON.parse(registryState),
    },
  };
}
