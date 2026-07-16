import { parentPort, workerData } from 'node:worker_threads';
import {
  createAgentSessionFromServices,
  type AgentSessionServices,
} from '@earendil-works/pi-coding-agent';
import type { SessionManager } from '@earendil-works/pi-coding-agent';
import { messageBus } from '../message-bus.js';
import { setCurrentChildId } from '../child-tools.js';
import type { ChildConfig } from '../types.js';

// ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

interface WorkerData {
  config: ChildConfig;
  services: AgentSessionServices;
  sessionManager: SessionManager;
  model: string;
  thinkingLevel: string;
  mission: string;
  context: Record<string, unknown>;
  tools: string[];
}

const data = workerData as WorkerData;
const { config, services, sessionManager, model, thinkingLevel, mission, context, tools } = data;

setCurrentChildId(config.id);

const port = parentPort!;
if (!port) {
  throw new Error('Child worker requires parentPort');
}

function parseModel(modelStr: string): { provider: string; id: string } {
  const i = modelStr.indexOf('/');
  if (i > 0) return { provider: modelStr.slice(0, i), id: modelStr.slice(i + 1) };
  return { provider: 'anthropic', id: modelStr };
}

async function handleMessage(port: any, raw: unknown, session: any, mission: string, context: Record<string, unknown>, config: ChildConfig, messageBus: any): Promise<void> {
  const msg = raw as { type: string; payload?: unknown };
  if (msg.type === 'task') {
    try {
      const output = await session.prompt(`Mission: ${mission}\n\nContext:\n${JSON.stringify(context, null, 2)}`);
      port.postMessage({ type: 'result', payload: { output } });
    } catch (err) {
      port.postMessage({
        type: 'error',
        payload: { message: err instanceof Error ? err.message : String(err), recoverable: false },
      });
    }
  } else if (msg.type === 'cancel') {
    port.postMessage({ type: 'error', payload: { message: 'Cancelled', recoverable: false } });
    process.exit(1);
  } else if (msg.type === 'input') {
    messageBus.sendToChild(config.id, msg as any);
  }
}

async function main() {
  try {
    const { provider, id } = parseModel(model);
    const resolvedModel = services.modelRegistry.find(provider, id);
    if (!resolvedModel) throw new Error(`Model not found: ${model}`);
    const { session } = await createAgentSessionFromServices({
      services,
      sessionManager,
      model: resolvedModel,
      thinkingLevel: thinkingLevel as ThinkingLevel,
      tools,
    });
    port.postMessage({ type: 'ready', childId: config.id });
    port.on('message', (raw) => { handleMessage(port, raw, session, mission, context, config, messageBus).catch(() => {}); });
    port.on('close', () => process.exit(0));
  } catch (err) {
    handleError(port, err);
  }
}

function handleError(port: any, err: any): void {
  port.postMessage({
    type: 'error',
    payload: { message: err instanceof Error ? err.message : String(err), recoverable: false },
  });
  process.exit(1);
}

main();