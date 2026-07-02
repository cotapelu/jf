import type { MultiSessionManager } from '../manager.js';
import { formatSession } from '../utils.js';

export async function operationCreate(
  mgr: MultiSessionManager,
  params: { name?: string; tags?: string[] }
) {
  const meta = await mgr.createChild({
    name: params.name,
    tags: params.tags,
  });

  return {
    content: [{ type: 'text', text: `✅ Created new child session: ${formatSession(meta)}` }],
    details: {
      operation: 'create',
      sessionId: meta.id,
      name: meta.name,
      tags: meta.tags,
      filePath: meta.filePath,
      parentId: meta.parentId,
      state: meta.state,
    },
  };
}
