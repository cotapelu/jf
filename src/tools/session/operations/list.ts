import type { SessionMetadata } from '../registry.js';
import type { MultiSessionManager } from '../manager.js';

function filterSessions(sessions: SessionMetadata[], filterState?: string): SessionMetadata[] {
  if (!filterState || filterState === 'all') return sessions;
  const state = filterState === 'active' ? 'active' : 'inactive';
  return sessions.filter(s => s.isActive === (state === 'active'));
}

function sortSessions(sessions: SessionMetadata[], sortBy?: string): SessionMetadata[] {
  const sorted = [...sessions];
  if (sortBy === 'name') {
    sorted.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  } else if (sortBy === 'id') {
    sorted.sort((a, b) => a.id.localeCompare(b.id));
  } else {
    sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  return sorted;
}

function applyLimit(sessions: SessionMetadata[], limit?: number): SessionMetadata[] {
  if (limit && limit > 0) {
    return sessions.slice(0, limit);
  }
  return sessions;
}

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
  sessions = filterSessions(sessions, params.filterState);
  sessions = sortSessions(sessions, params.sortBy);
  sessions = applyLimit(sessions, params.limit);
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
