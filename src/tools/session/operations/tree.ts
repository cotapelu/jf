import type { MultiSessionManager } from '../manager.js';
import { renderTree, countNodes } from '../utils.js';

export function operationTree(mgr: MultiSessionManager) {
  const tree = mgr.getTree();
  const lines = renderTree(tree.roots);
  const rootInfo = mgr.getRoot();
  return {
    content: [{ type: 'text', text: `🌳 Session Tree:\n` + (rootInfo ? `Root: ${rootInfo.id} "${rootInfo.name ?? '(unnamed)'}"\n` : '') + lines.join('\n') }],
    details: { operation: 'tree', rootId: rootInfo?.id, totalNodes: tree.roots.reduce((acc, n) => acc + countNodes(n), 0) }
  };
}
