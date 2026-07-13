import { messageBus } from './message-bus.js';
import { MultiAgentRuntime } from './runtime.js';
import type { SpawnChildParams, SendMessageParams, AwaitResultParams, ListChildrenParams, TerminateChildParams, ChildInfo, ChildToParentMessage } from './types.js';

/**
 * Runtime instance for parent tools (set by MultiAgentRuntime)
 */
let runtimeInstance: MultiAgentRuntime | null = null;

/**
 * Set the multi-agent runtime instance. Internal use only.
 * @param runtime - The runtime to use for child operations
 */
export function setRuntime(runtime: MultiAgentRuntime): void {
  runtimeInstance = runtime;
}

/**
 * Get the current runtime instance.
 * @throws {Error} If runtime not initialized
 * @internal
 */
function getRuntime(): MultiAgentRuntime {
  if (!runtimeInstance) {
    throw new Error('MultiAgentRuntime not initialized. Call setRuntime() first.');
  }
  return runtimeInstance;
}

/**
 * Spawn a new child agent.
 *
 * Creates a new child agent with specified type, mission, context, and tools.
 * Returns immediately with child ID; child starts asynchronously.
 *
 * @param params - Spawn configuration (type, mission, context, tools)
 * @returns Confirmation with child ID
 * @throws {Error} If runtime not initialized
 */
export async function spawnChild(params: SpawnChildParams): Promise<{ content: { type: 'text'; text: string }[]; details: { childId: string } }> {
  const runtime = getRuntime();
  const childId = await runtime.spawnChild({
    type: params.type,
    mission: params.mission,
    context: params.context ?? {},
    tools: params.tools ?? [],
  });
  return {
    content: [{ type: 'text', text: `Spawned child ${childId} (${params.type}): ${params.mission}` }],
    details: { childId },
  };
}

/**
 * Send a message to a child agent.
 *
 * Fire-and-forget communication to child. Does not wait for response.
 * Use {@link (awaitResult)} to receive results.
 *
 * @param params - Message parameters (childId, message object)
 * @returns Confirmation that message was sent
 * @throws {Error} If child not found
 */
export async function sendMessage(params: SendMessageParams): Promise<{ content: { type: 'text'; text: string }[] }> {
  const runtime = getRuntime();
  const child = runtime.getChild(params.childId);
  if (!child) {
    throw new Error(`Child not found: ${params.childId}`);
  }
  messageBus.sendToChild(params.childId, params.message);
  return { content: [{ type: 'text', text: `Message sent to child ${params.childId}` }] };
}

/**
 * Wait for a result message from a child agent.
 *
 * Blocks up to timeoutMs (default 120s) listening for a 'result' message.
 * Use after sending a task to child that will eventually complete.
 *
 * @param params - Await parameters (childId, timeoutMs)
 * @returns Result message if received, or timeout null
 * @throws {Error} If child not found
 */
export async function awaitResult(params: AwaitResultParams): Promise<{ content: { type: 'text'; text: string }[]; details: ChildToParentMessage | null }> {
  const runtime = getRuntime();
  const child = runtime.getChild(params.childId);
  if (!child) {
    throw new Error(`Child not found: ${params.childId}`);
  }

  const message = await messageBus.waitForParentMessage(
    params.childId,
    'result',
    params.timeoutMs ?? 120000
  );

  if (!message) {
    return {
      content: [{ type: 'text', text: `Timeout waiting for result from child ${params.childId}` }],
      details: null,
    };
  }

  return {
    content: [{ type: 'text', text: `Result received from child ${params.childId}` }],
    details: message,
  };
}

/**
 * List all child agents, optionally filtered by status.
 *
 * Returns summary lines and detailed child info array.
 *
 * @param params - Filter parameters (status optional)
 * @returns List of children with their IDs, types, status, and missions
 */
export async function listChildren(params: ListChildrenParams): Promise<{ content: { type: 'text'; text: string }[]; details: ChildInfo[] }> {
  const runtime = getRuntime();
  const children = runtime.listChildren(params.status);
  const text = children.length === 0
    ? 'No children'
    : children.map((c) => `${c.id} (${c.type}) [${c.status}]: ${c.mission}`).join('\n');

  return {
    content: [{ type: 'text', text }],
    details: children,
  };
}

/**
 * Terminate a child agent.
 *
 * Stops the child agent and cleans up resources. If force is true,
 * terminates even if child is busy; otherwise graceful shutdown.
 *
 * @param params - Termination parameters (childId, force)
 * @returns Confirmation message
 */
export async function terminateChild(params: TerminateChildParams): Promise<{ content: { type: 'text'; text: string }[] }> {
  const runtime = getRuntime();
  await runtime.terminateChild(params.childId, params.force);
  return { content: [{ type: 'text', text: `Child ${params.childId} terminated` }] };
}

/**
 * Parent-side tool collection for multi-agent operations.
 *
 * Provides high-level functions for spawning, communicating with,
 * and managing child agents.
 */
export const parentTools = {
  spawnChild,
  sendMessage,
  awaitResult,
  listChildren,
  terminateChild,
};