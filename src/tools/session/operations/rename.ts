import type { MultiSessionManager } from '../manager.js';

export function operationRename(
  mgr: MultiSessionManager,
  params: { sessionId?: string; name?: string }
) {
  const sessionId = params.sessionId ?? mgr.getActive()?.id;
  if (!sessionId) {
    throw new Error('No active session and no sessionId provided');
  }
  if (!params.name) {
    throw new Error('Name is required for rename operation');
  }

  const meta = mgr.rename(sessionId, params.name);
  if (!meta) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  return {
    content: [{ type: 'text', text: `✏️ Renamed session ${sessionId} to "${params.name}"` }],
    details: { operation: 'rename', sessionId: meta.id, newName: meta.name },
  };
}
