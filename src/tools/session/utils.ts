import type { SessionMetadata, SessionTreeNode } from './registry.js';
import type { MultiSessionManager } from './manager.js';

/**
 * Format session metadata for display
 */
export function formatSession(meta: SessionMetadata): string {
  const active = meta.isActive ? '🟢' : '⚪';
  const name = meta.name ? `"${meta.name}"` : '(unnamed)';
  const tags = meta.tags.length > 0 ? `[${meta.tags.join(', ')}]` : '';
  const createdAt = meta.createdAt.toLocaleTimeString();
  const file = meta.filePath.split('/').pop();

  return `${active} ${meta.id} ${name} ${tags} (${file}, ${createdAt})`;
}

/**
 * Count total nodes in tree
 */
export function countNodes(node: SessionTreeNode): number {
  return (
    1 + node.children.reduce((acc: number, child: SessionTreeNode) => acc + countNodes(child), 0)
  );
}

/**
 * Render tree structure as string lines
 */
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

export function renderTree(nodes: SessionTreeNode[], prefix: string = ''): string[] {
  return nodes.flatMap((node, idx) => {
    const isLast = idx === nodes.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const active = node.session.isActive ? '🟢' : '⚪';
    const name = node.session.name ?? '(unnamed)';
    const line = `${prefix}${connector}${active} ${node.session.id} "${name}"`;

    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const childrenLines = renderTree(node.children, childPrefix);

    return [line, ...childrenLines];
  });
}
