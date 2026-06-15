import { messageBus } from './message-bus.js';
import { MultiAgentRuntime } from './runtime.js';
import type { ParentToChildMessage, ChildToParentMessage, SpawnChildParams, SendMessageParams, AwaitResultParams, ListChildrenParams, TerminateChildParams, ChildInfo, ChildStatus } from './types.js';

let runtimeInstance: MultiAgentRuntime | null = null;

export function setRuntime(runtime: MultiAgentRuntime): void {
  runtimeInstance = runtime;
}

function getRuntime(): MultiAgentRuntime {
  if (!runtimeInstance) {
    throw new Error('MultiAgentRuntime not initialized. Call setRuntime() first.');
  }
  return runtimeInstance;
}

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

export async function sendMessage(params: SendMessageParams): Promise<{ content: { type: 'text'; text: string }[] }> {
  const runtime = getRuntime();
  const child = runtime.getChild(params.childId);
  if (!child) {
    throw new Error(`Child not found: ${params.childId}`);
  }
  messageBus.sendToChild(params.childId, params.message);
  return { content: [{ type: 'text', text: `Message sent to child ${params.childId}` }] };
}

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

export async function terminateChild(params: TerminateChildParams): Promise<{ content: { type: 'text'; text: string }[] }> {
  const runtime = getRuntime();
  await runtime.terminateChild(params.childId, params.force);
  return { content: [{ type: 'text', text: `Child ${params.childId} terminated` }] };
}

export const parentTools = {
  spawnChild,
  sendMessage,
  awaitResult,
  listChildren,
  terminateChild,
};