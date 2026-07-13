import type { MultiSessionManager } from '../manager.js';
import { formatSession } from '../utils.js';

export async function operationSwitch(mgr: MultiSessionManager, params: { sessionId?: string }) {
  const targetId = params.sessionId === 'parent' ? mgr.getRoot()?.id : params.sessionId === 'last' ? mgr.getChildren()[0]?.id : params.sessionId;
  if (!targetId) throw new Error('Target session not specified or not found');
  await mgr.switchTo(targetId);
  const target = mgr.get(targetId)!;
  return { content: [{ type: 'text', text: `🔄 Switched to session: ${formatSession(target)}` }], details: { operation: 'switch', sessionId: target.id, name: target.name, filePath: target.filePath, activeSession: mgr.getActive()?.id } };
}

