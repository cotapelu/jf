import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChildConfig, ChildInfo, ChildStatus, ChildType, ParentToChildMessage, ParentConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ChildInstance {
  config: ChildConfig;
  worker: Worker | null;
  status: ChildStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: unknown;
  messageQueue: ParentToChildMessage[];
}

export class MultiAgentRuntime {
  private children = new Map<string, ChildInstance>();
  private childCounter = 0;
  private parentAgent: unknown = null;
  private parentConfig: ParentConfig | null = null;

  setParentAgent(agent: unknown): void {
    this.parentAgent = agent;
  }

  setParentConfig(config: ParentConfig): void {
    this.parentConfig = config;
  }

  async spawnChild(params: { type: ChildType; mission: string; context: Record<string, unknown>; tools: string[] }): Promise<string> {
    if (!this.parentConfig) {
      throw new Error('Parent config not set. Call setParentConfig() first.');
    }

    this.childCounter++;
    const childId = `child-${this.childCounter}-${Date.now()}`;

    const config: ChildConfig = {
      id: childId,
      type: params.type,
      mission: params.mission,
      context: params.context,
      tools: params.tools,
      createdAt: new Date().toISOString(),
    };

    const instance: ChildInstance = {
      config,
      worker: null,
      status: 'starting',
      messageQueue: [],
    };

    this.children.set(childId, instance);

    const workerPath = path.join(__dirname, 'worker', 'child-worker.js');
    const worker = new Worker(workerPath, {
      workerData: {
        childId,
        config,
        services: this.parentConfig.services,
        sessionManager: this.parentConfig.sessionManager,
        model: this.parentConfig.model,
        thinkingLevel: this.parentConfig.thinkingLevel,
        mission: params.mission,
        context: params.context,
        tools: params.tools,
      },
    });

    instance.worker = worker;
    instance.status = 'running';
    instance.startedAt = new Date().toISOString();

    worker.on('message', (msg) => this.handleWorkerMessage(childId, msg));
    worker.on('error', (err: Error) => this.handleWorkerError(childId, err));
    worker.on('exit', (code: number) => this.handleWorkerExit(childId, code));

    this.sendToChild(childId, {
      type: 'task',
      payload: { mission: params.mission, context: params.context, tools: params.tools },
    });

    return childId;
  }

  private handleWorkerMessage(childId: string, msg: any): void {
    const instance = this.children.get(childId);
    if (!instance) return;

    switch (msg.type) {
      case 'progress':
        break;
      case 'question':
        instance.status = 'waiting-input';
        break;
      case 'result':
        instance.status = 'completed';
        instance.completedAt = new Date().toISOString();
        instance.result = msg.payload?.output;
        break;
      case 'error':
        instance.status = 'error';
        instance.error = msg.payload?.message;
        break;
      case 'ready':
        break;
    }
  }

  private handleWorkerError(childId: string, err: Error): void {
    const instance = this.children.get(childId);
    if (instance) {
      instance.status = 'error';
      instance.error = err.message;
    }
  }

  private handleWorkerExit(childId: string, code: number): void {
    const instance = this.children.get(childId);
    if (instance && instance.status === 'running') {
      instance.status = code === 0 ? 'completed' : 'error';
      instance.completedAt = new Date().toISOString();
      if (code !== 0 && !instance.error) {
        instance.error = `Worker exited with code ${code}`;
      }
    }
  }

  sendToChild(childId: string, message: ParentToChildMessage): void {
    const instance = this.children.get(childId);
    if (!instance) {
      throw new Error(`Child not found: ${childId}`);
    }

    if (instance.worker) {
      instance.worker.postMessage(message);
    } else {
      instance.messageQueue.push(message);
    }
  }

  getChild(childId: string): ChildInfo | null {
    const instance = this.children.get(childId);
    if (!instance) return null;

    return {
      id: instance.config.id,
      type: instance.config.type,
      status: instance.status,
      mission: instance.config.mission,
      createdAt: instance.config.createdAt,
      startedAt: instance.startedAt,
      completedAt: instance.completedAt,
      error: instance.error,
      result: instance.result,
    };
  }

  listChildren(status?: ChildStatus): ChildInfo[] {
    const result: ChildInfo[] = [];
    for (const instance of this.children.values()) {
      if (!status || instance.status === status) {
        result.push(this.getChild(instance.config.id)!);
      }
    }
    return result.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }

  async terminateChild(childId: string, force = false): Promise<void> {
    const instance = this.children.get(childId);
    if (!instance) {
      throw new Error(`Child not found: ${childId}`);
    }

    if (instance.worker) {
      if (force) {
        instance.worker.terminate();
      } else {
        instance.worker.postMessage({ type: 'cancel' });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if ((instance.worker as any).threadId) {
          instance.worker.terminate();
        }
      }
    }

    instance.status = 'terminated';
    instance.completedAt = new Date().toISOString();
  }

  onChildMessage(_childId: string, _handler: (msg: any) => void): () => void {
    return () => {};
  }
}

export const multiAgentRuntime = new MultiAgentRuntime();