import type { MultiSessionManager } from '../manager.js';

export async function operationDelete(mgr: MultiSessionManager, params: { sessionId?: string }) {
  const sessionId = params.sessionId ?? mgr.getActive()?.id;
  if (!sessionId) {
    throw new Error('No active session and no sessionId provided');
  }

  await mgr.dispose(sessionId);

  return {
    content: [
      {
        type: 'text',
        text: `🗑️ Deleted session from registry: ${sessionId}\n(Note: session file remains on disk)`,
      },
    ],
    details: { operation: 'delete', sessionId },
  };
}
