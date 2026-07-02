import type { SessionMetadata } from '../registry.js';
import type { MultiSessionManager } from '../manager.js';

export function operationList(
  mgr: MultiSessionManager,
  params: {
    filterState?: 'active' | 'inactive' | 'all';
    sortBy?: 'created' | 'name' | 'id';
    limit?: number;
  }
) {
  const includeDisposed = params.filterState === 'all';
  let sessions = mgr.list({ includeDisposed });

  // Filter by state
  if (params.filterState === 'active' || params.filterState === 'inactive') {
    const state = params.filterState === 'active' ? 'active' : 'inactive';
    sessions = sessions.filter((s) => s.isActive === (state === 'active'));
  }

  // Sort
  if (params.sortBy === 'name') {
    sessions.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  } else if (params.sortBy === 'id') {
    sessions.sort((a, b) => a.id.localeCompare(b.id));
  } else {
    sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Limit
  if (params.limit && params.limit > 0) {
    sessions = sessions.slice(0, params.limit);
  }

  return { sessions };
}

export function formatListOutput(sessions: SessionMetadata[], mgr: MultiSessionManager): string {
  const activeId = mgr.getActive()?.id;
  const lines = sessions.map((s) => {
    const active = s.id === activeId ? '🟢' : '⚪';
    const name = s.name ? `"${s.name}"` : '(unnamed)';
    const tags = s.tags.length > 0 ? `[${s.tags.slice(0, 3).join(', ')}]` : '';
    const file = s.filePath.split('/').pop();
    return `${active} ${s.id} ${name} ${tags} (${file})`;
  });

  return (
    `📋 Sessions (${sessions.length} total, ${mgr.getActive()?.id ? '1 active' : '0 active'}):\n` +
    lines.join('\n')
  );
}
