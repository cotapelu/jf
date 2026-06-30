import type { MultiSessionManager } from '../manager.js';

export function operationInfo(mgr: MultiSessionManager, params: { sessionId?: string }) {
  const sessionId = params.sessionId ?? mgr.getActive()?.id;
  if (!sessionId) {
    throw new Error('No active session and no sessionId provided');
  }

  const meta = mgr.get(sessionId);
  if (!meta) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const childCount = mgr.getRegistry().getChildren(meta.id).length;

  return {
    content: [
      {
        type: 'text',
        text:
          `📄 Session Info:\n` +
          `ID: ${meta.id}\n` +
          `Name: ${meta.name ?? '(unnamed)'}\n` +
          `State: ${meta.state}\n` +
          `Active: ${meta.isActive}\n` +
          `Tags: ${meta.tags.length > 0 ? meta.tags.join(', ') : '(none)'}\n` +
          `File: ${meta.filePath}\n` +
          `Parent: ${meta.parentId ?? '(none)'}\n` +
          `Created: ${meta.createdAt.toLocaleString()}\n` +
          `Children: ${childCount}`,
      },
    ],
    details: {
      operation: 'info',
      session: {
        id: meta.id,
        name: meta.name,
        state: meta.state,
        isActive: meta.isActive,
        tags: meta.tags,
        filePath: meta.filePath,
        parentId: meta.parentId,
        createdAt: meta.createdAt.toISOString(),
        childCount,
      },
    },
  };
}
