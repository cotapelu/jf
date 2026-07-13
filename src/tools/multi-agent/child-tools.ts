import { messageBus } from './message-bus.js';
import type { AskQuestionParams, ChildErrorParams, CompleteParams, ReportProgressParams } from './types.js';

/**
 * Current child agent ID (set by runtime when entering child context)
 */
let currentChildId: string | null = null;

/**
 * Set the current child agent ID. Internal use only.
 * @param childId - The child session ID
 */
export function setCurrentChildId(childId: string): void {
  currentChildId = childId;
}

/**
 * Get the current child agent ID.
 * @returns The child session ID if inside child context, null otherwise
 */
export function getCurrentChildId(): string | null {
  return currentChildId;
}

/**
 * Get current child ID or throw if not in child context.
 * @throws {Error} If not inside a child agent
 */
function getCurrentChildIdOrThrow(): string {
  const id = currentChildId;
  if (!id) throw new Error('Not inside child agent');
  return id;
}

/**
 * Send a message to the parent agent.
 * @param message - The message to send (type + payload)
 */
function sendToParent(message: { type: string; payload: unknown }): void {
  messageBus.sendToParent(message as any, getCurrentChildIdOrThrow());
}

/**
 * Report progress update to the parent agent.
 *
 * Displays a checkpoint message and sends progress details upstream.
 *
 * @param params - Progress parameters (checkpoint, details, etc.)
 * @returns Tool result with progress content
 */
export function reportProgress(params: ReportProgressParams) {
  sendToParent({ type: 'progress', payload: params });
  return { content: [{ type: 'text' as const, text: `Progress: ${params.checkpoint}` }], details: params };
}

/**
 * Ask a question to the parent agent and wait for a response.
 *
 * Blocks (up to 120s) for parent input. Used for interactive child agents.
 *
 * @param params - Question parameters (question, details, etc.)
 * @returns Promise resolving to parent's response text
 * @throws {Error} If not called from within child context
 */
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

/**
 * Signal successful completion of a child agent task.
 *
 * Sends a result message to the parent and returns a completion confirmation.
 *
 * @param params - Completion parameters (result, artifacts, status, etc.)
 * @returns Tool result with completion details
 */
export function complete(params: CompleteParams) {
  sendToParent({ type: 'result', payload: params });
  return { content: [{ type: 'text' as const, text: 'Completed' }], details: params };
}

/**
 * Signal error/failed completion from child agent.
 *
 * Sends an error message to the parent with failure details.
 *
 * @param params - Error parameters (message, error type, stack, etc.)
 * @returns Tool result with error details
 */
export function error(params: ChildErrorParams) {
  sendToParent({ type: 'error', payload: params });
  return { content: [{ type: 'text' as const, text: `Error: ${params.message}` }], details: params };
}

/**
 * Child agent tool set for communication with parent.
 *
 * Provides: reportProgress, askQuestion, complete, error
 */
export const childTools = { reportProgress, askQuestion, complete, error };
