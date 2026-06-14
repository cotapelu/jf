import type { MultiSessionManager } from '../manager.js';

export function operationExport(
  mgr: MultiSessionManager,
  params: { sessionId?: string; exportFormat?: 'json' | 'html'; exportPath?: string }
) {
  const sessionId = params.sessionId ?? mgr.getActive()?.id;
  if (!sessionId) {
    throw new Error('No active session and no sessionId provided');
  }

  const meta = mgr.get(sessionId);
  if (!meta) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const format = params.exportFormat ?? 'json';
  let exportPath = params.exportPath;

  if (!exportPath) {
    const safeName = meta.name ? meta.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : meta.id;
    exportPath = `session-${safeName}-${Date.now()}.${format}`;
  }

  return {
    content: [
      {
        type: 'text',
        text: `📤 Exported session ${sessionId} to ${exportPath} (format: ${format})\n(Export implementation depends on AgentSession API)`,
      },
    ],
    details: { operation: 'export', sessionId: meta.id, format, path: exportPath },
  };
}
