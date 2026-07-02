import { messageBus } from './message-bus.js';
import type { AskQuestionParams, ChildErrorParams, CompleteParams, ReportProgressParams } from './types.js';

let currentChildId: string | null = null;

export function setCurrentChildId(childId: string): void {
  currentChildId = childId;
}

export function getCurrentChildId(): string | null {
  return currentChildId;
}

function getCurrentChildIdOrThrow(): string {
  const id = currentChildId;
  if (!id) throw new Error('Not inside child agent');
  return id;
}

function sendToParent(message: { type: string; payload: unknown }): void {
  messageBus.sendToParent(message as any, getCurrentChildIdOrThrow());
}

export function reportProgress(params: ReportProgressParams) {
  sendToParent({ type: 'progress', payload: params });
  return { content: [{ type: 'text' as const, text: `Progress: ${params.checkpoint}` }], details: params };
}

export function askQuestion(params: AskQuestionParams) {
  const id = getCurrentChildIdOrThrow();
  sendToParent({ type: 'question', payload: params });

  return new Promise<{ content: { type: 'text'; text: string }[] }>((resolve) => {
    const timer = setTimeout(() => resolve({ content: [{ type: 'text', text: 'timeout' }] }), 120000);

    const unsub = messageBus.onIncomingMessage(id, (msg) => {
      if (msg.type === 'input') {
        clearTimeout(timer);
        unsub();
        const payload = (msg as { payload?: unknown }).payload;
        const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
        resolve({ content: [{ type: 'text', text }] });
      }
    });
  });
}

export function complete(params: CompleteParams) {
  sendToParent({ type: 'result', payload: params });
  return { content: [{ type: 'text' as const, text: 'Completed' }], details: params };
}

export function error(params: ChildErrorParams) {
  sendToParent({ type: 'error', payload: params });
  return { content: [{ type: 'text' as const, text: `Error: ${params.message}` }], details: params };
}

export const childTools = { reportProgress, askQuestion, complete, error };
