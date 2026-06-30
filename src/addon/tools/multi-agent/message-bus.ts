import { EventEmitter } from 'node:events';
import type { ParentToChildMessage, ChildToParentMessage, MessageEnvelope } from './types.js'; // removed unused message types

type ParentToChildHandler = (msg: ParentToChildMessage, envelope: MessageEnvelope<ParentToChildMessage>) => void;
type ChildToParentHandler = (msg: ChildToParentMessage, envelope: MessageEnvelope<ChildToParentMessage>) => void;

export class MessageBus extends EventEmitter {
  private parentToChildHandlers = new Map<string, ParentToChildHandler[]>();
  private childToParentHandlers: ChildToParentHandler[] = [];
  private childIncomingHandlers = new Map<string, ((msg: ParentToChildMessage) => void)[]>();

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private createEnvelope<M extends ParentToChildMessage | ChildToParentMessage>(
    from: 'parent' | 'child',
    to: string,
    message: M
  ): MessageEnvelope<M> {
    return {
      from,
      to,
      type: message.type,
      payload: 'payload' in message ? message.payload : undefined as any,
      timestamp: new Date().toISOString(),
      correlationId: this.generateCorrelationId(),
    };
  }

  sendToChild(childId: string, message: ParentToChildMessage): void {
    const envelope = this.createEnvelope('parent', childId, message);

    const handlers = this.parentToChildHandlers.get(childId) ?? [];
    for (const handler of handlers) {
      handler(message, envelope);
    }

    const incomingHandlers = this.childIncomingHandlers.get(childId) ?? [];
    for (const handler of incomingHandlers) {
      handler(message);
    }

    this.emit(`child:${childId}`, envelope);
    this.emit('message', envelope);
  }

  broadcastToAll(message: ParentToChildMessage): void {
    for (const childId of this.parentToChildHandlers.keys()) {
      this.sendToChild(childId, message);
    }
  }

  onChildMessage(childId: string, handler: (msg: ParentToChildMessage, envelope: any) => void): () => void {
    const handlers = this.parentToChildHandlers.get(childId) ?? [];
    handlers.push(handler);
    this.parentToChildHandlers.set(childId, handlers);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }

  onIncomingMessage(childId: string, handler: (msg: ParentToChildMessage) => void): () => void {
    const handlers = this.childIncomingHandlers.get(childId) ?? [];
    handlers.push(handler);
    this.childIncomingHandlers.set(childId, handlers);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }

  sendToParent(message: ChildToParentMessage, _childId: string): void {
    const envelope = this.createEnvelope('child', 'parent', message);

    for (const handler of this.childToParentHandlers) {
      handler(message, envelope);
    }
    this.emit(`parent`, envelope);
    this.emit('message', envelope);
  }

  waitForParentMessage<T extends ChildToParentMessage['type']>(
    childId: string,
    type: T,
    timeoutMs = 30000
  ): Promise<Extract<ChildToParentMessage, { type: T }> | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.off(`child:${childId}`, listener);
        resolve(null);
      }, timeoutMs);

      const listener = (envelope: any) => {
        if (envelope.from === 'child' && envelope.to === 'parent' && envelope.type === type) {
          clearTimeout(timer);
          this.off(`child:${childId}`, listener);
          resolve(envelope);
        }
      };

      this.on(`child:${childId}`, listener);
    });
  }

  waitForIncomingMessage(
    childId: string,
    type: ParentToChildMessage['type'],
    timeoutMs = 30000
  ): Promise<ParentToChildMessage | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(null);
      }, timeoutMs);

      const handler = (msg: ParentToChildMessage) => {
        if (msg.type === type) {
          clearTimeout(timer);
          const handlers = this.childIncomingHandlers.get(childId) ?? [];
          const idx = handlers.indexOf(handler);
          if (idx >= 0) handlers.splice(idx, 1);
          resolve(msg);
        }
      };

      const handlers = this.childIncomingHandlers.get(childId) ?? [];
      handlers.push(handler);
      this.childIncomingHandlers.set(childId, handlers);
    });
  }

  clearChild(childId: string): void {
    this.parentToChildHandlers.delete(childId);
    this.childIncomingHandlers.delete(childId);
  }
}

export const messageBus = new MessageBus();