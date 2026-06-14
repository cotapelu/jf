import type { MultiSessionManager } from '../manager.js';

export function operationTag(
  mgr: MultiSessionManager,
  params: { sessionId?: string; tags?: string[]; tagAction?: 'add' | 'remove' }
) {
  const sessionId = params.sessionId ?? mgr.getActive()?.id;
  if (!sessionId) {
    throw new Error('No active session and no sessionId provided');
  }
  if (!params.tags || params.tags.length === 0) {
    throw new Error('Tags are required for tag operation');
  }
  if (!params.tagAction) {
    throw new Error('tagAction (add or remove) is required');
  }

  const meta =
    params.tagAction === 'add'
      ? mgr.addTags(sessionId, ...params.tags)
      : mgr.removeTags(sessionId, ...params.tags);

  if (!meta) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  return {
    content: [
      {
        type: 'text',
        text: `🏷️ ${params.tagAction === 'add' ? 'Added' : 'Removed'} tags ${params.tags.join(', ')} to session ${sessionId}. Current tags: ${meta.tags.join(', ') || '(none)'}`,
      },
    ],
    details: { operation: 'tag', action: params.tagAction, sessionId: meta.id, tags: meta.tags },
  };
}
