import type { MultiSessionManager } from '../manager.js';

export function operationStatus(mgr: MultiSessionManager) {
  const active = mgr.getActive();
  const root = mgr.getRoot();
  const children = mgr.getChildren();
  const diagnostics = mgr.getDiagnostics();

  return {
    content: [
      {
        type: 'text',
        text:
          `📊 Session Status:\n` +
          `Active Session: ${active?.id ?? 'none'} ${active?.name ? `("${active.name}")` : ''}\n` +
          `Root Session: ${root?.id ?? 'none'}\n` +
          `Total Sessions: ${diagnostics.totalSessions}\n` +
          `Children: ${children.length}\n` +
          `Disposed: ${diagnostics.disposedCount}\n` +
          `History Entries: ${diagnostics.historySize}`,
      },
    ],
    details: {
      operation: 'status',
      diagnostics,
      activeSession: active
        ? { id: active.id, name: active.name, filePath: active.filePath }
        : null,
      rootSession: root ? { id: root.id, name: root.name, filePath: root.filePath } : null,
      children: children.map((c) => ({ id: c.id, name: c.name })),
    },
  };
}
