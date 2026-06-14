import type { MultiSessionManager } from '../manager.js';

export function operationHistory(mgr: MultiSessionManager, params: { limit?: number }) {
  const limit = params.limit ?? 20;
  const history = mgr.getHistory(limit);

  const lines = history.map(
    (h) =>
      `${h.timestamp.toLocaleTimeString()} [${h.operation}] ${h.sessionId} - ${JSON.stringify(h.details)}`
  );

  return {
    content: [
      {
        type: 'text',
        text: `📜 Operation History (last ${history.length} entries):\n` + lines.join('\n'),
      },
    ],
    details: {
      operation: 'history',
      count: history.length,
      entries: history.map((h) => ({
        timestamp: h.timestamp.toISOString(),
        operation: h.operation,
        sessionId: h.sessionId,
        details: h.details,
      })),
    },
  };
}
