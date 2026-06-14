/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AgentSession, AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import { SessionRegistry, SessionMetadata } from './registry.js';

/**
 * Simple async mutex for serializing operations
 */
class Mutex {
  private locked = false;
  private waiting: Array<{
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.locked) {
      this.locked = true;
      try {
        return await fn();
      } finally {
        this.locked = false;
        if (this.waiting.length > 0) {
          const next = this.waiting.shift()!;
          // Execute next with lock re-acquired
          this.run(next.fn).then(next.resolve, next.reject).catch(() => {});
        }
      }
    } else {
      return new Promise<T>((resolve, reject) => {
        this.waiting.push({ fn, resolve, reject });
      });
    }
  }
}

export interface MultiSessionManagerOptions {
  /** Whether to allow creating multiple child sessions */
  allowMultipleChildren?: boolean;
  /** Max number of sessions to keep in registry (0 = unlimited) */
  maxSessions?: number;
  /** Maximum history entries to retain (0 = unlimited, default 1000) */
  maxHistoryEntries?: number;
}

/**
 * MultiSessionManager - Advanced session lifecycle manager
 *
 * Replaces the old ParentChildSessionManager with:
 * - Unlimited child sessions (configurable)
 * - Full session registry with metadata
 * - Tree-based session relationships
 * - Proper validation and error recovery
 * - Diagnostic capabilities
 *
 * Core concepts:
 * - Parent: The original/root session created with the runtime
 * - Child: Any session created via newSession() (fork or fresh)
 * - Active: The session currently bound to runtime.session
 *
 * Usage:
 * ```typescript
 * const manager = new MultiSessionManager(runtime);
 *
 * // Create child
 * await manager.createChild({ name: "task-1" });
 *
 * // Switch sessions
 * await manager.switchTo(sessionId);
 *
 * // List all sessions
 * const all = manager.list();
 *
 * // Dispose specific session
 * await manager.dispose(sessionId);
 * ```
 */
export class MultiSessionManager {
  private readonly runtime: AgentSessionRuntime;
  private readonly registry: SessionRegistry;
  private readonly options: Required<MultiSessionManagerOptions>;

  // Cache the root/parent session ID
  private rootSessionId: string | null = null;

  // Mutex to serialize operations that access runtime.session
  private readonly sessionMutex = new Mutex();

  constructor(runtime: AgentSessionRuntime, options: MultiSessionManagerOptions = {}) {
    const maxHistory = options.maxHistoryEntries ?? 1000;
    this.runtime = runtime;
    this.registry = new SessionRegistry({ maxHistoryEntries: maxHistory });
    this.options = {
      allowMultipleChildren: true,
      maxSessions: 0,
      maxHistoryEntries: maxHistory,
      ...options,
    };

    // Register the initial (parent) session
    this.initializeParentSession();
  }

  /**
   * Initialize and register the parent session
   */
  private initializeParentSession(): void {
    const parentSession = this.runtime.session;
    const meta = this.registry.register(parentSession, {
      name: 'parent',
      tags: ['root', 'parent'],
      parentId: null,
    });
    this.rootSessionId = meta.id;
    console.log(`✅ Parent session registered: ${meta.id} (${meta.filePath})`);
  }

  /**
   * Get the SessionRegistry
   */
  getRegistry(): SessionRegistry {
    return this.registry;
  }

  /**
   * Create a new child session
   *
   * This calls runtime.newSession() and registers the result.
   * By default, allows unlimited children. Pass { maxChildren: N } to limit.
   *
   * @param options Optional metadata for the new session
   * @returns Metadata of the created child session
   */
  async createChild(
    options: {
      name?: string;
      tags?: string[];
      parentSession?: string; // defaults to current active
    } = {}
  ): Promise<SessionMetadata> {
    return this.sessionMutex.run(async () => {
      const parentId = options.parentSession ?? this.registry.getActive()?.id ?? this.rootSessionId;

      if (!parentId) {
        throw new Error('No parent session available');
      }

      // Check max sessions limit
      if (this.options.maxSessions > 0 && this.registry.count >= this.options.maxSessions) {
        throw new Error(
          `Max sessions limit (${this.options.maxSessions}) reached. ` +
            `Dispose old sessions before creating new ones.`
        );
      }

      // Call runtime to create new session
      const parentMeta = this.registry.get(parentId);
      const result = await this.runtime.newSession({
        parentSession: parentMeta?.filePath,
      });

      if (result.cancelled) {
        throw new Error('Session creation was cancelled');
      }

      // The runtime.session is now the new child
      const childSession = this.runtime.session;

      // Register with metadata
      const metadata = this.registry.register(childSession, {
        name: options.name ?? `child-${this.registry.count}`,
        tags: [...(options.tags ?? []), 'child'],
        parentId: parentId,
      });

      console.log(`✅ Created child session: ${metadata.id} (parent: ${parentId})`);
      return metadata;
    });
  }

  /**
   * Switch runtime to a specific session
   *
   * @param sessionId The session ID to switch to
   * @throws Error if session not found or already active
   */
  async switchTo(sessionId: string): Promise<void> {
    return this.sessionMutex.run(async () => {
      if (!this.registry.has(sessionId)) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const currentActive = this.registry.getActive();
      if (currentActive?.id === sessionId) {
        throw new Error(`Already active on session: ${sessionId}`);
      }

      const targetMeta = this.registry.get(sessionId)!;
      const success = this.registry.setActive(sessionId);

      if (!success) {
        throw new Error(`Failed to activate session: ${sessionId}`);
      }

      // Switch runtime's session
      await this.runtime.switchSession(targetMeta.filePath);

      console.log(`🔄 Switched to session: ${sessionId} (${targetMeta.filePath})`);
    });
  }

  /**
   * Switch to the parent/root session
   */
  async switchToParent(): Promise<void> {
    if (!this.rootSessionId) {
      throw new Error('Parent session not available');
    }
    await this.switchTo(this.rootSessionId);
  }

  /**
   * Switch to a specific child session by index or ID
   *
   * @param childIdOrIndex Child session ID or index (0-based from most recent)
   */
  async switchToChild(childIdOrIndex: string | number): Promise<void> {
    const children = this.registry.getChildren(this.rootSessionId!);

    if (children.length === 0) {
      throw new Error('No child sessions available');
    }

    let targetId: string;
    if (typeof childIdOrIndex === 'number') {
      // Index from most recent (0 = most recent)
      const sorted = [...children].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (childIdOrIndex < 0 || childIdOrIndex >= sorted.length) {
        throw new Error(`Child index out of range: ${childIdOrIndex}`);
      }
      targetId = sorted[childIdOrIndex].id;
    } else {
      targetId = childIdOrIndex;
    }

    await this.switchTo(targetId);
  }

  /**
   * Switch to the most recent child session
   */
  async switchToLastChild(): Promise<void> {
    const children = this.registry.getChildren(this.rootSessionId!);
    if (children.length === 0) {
      throw new Error('No child sessions available');
    }
    const mostRecent = children.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    await this.switchTo(mostRecent.id);
  }

  /**
   * Dispose a specific session
   *
   * @param sessionId Session to dispose (null = current active)
   * @param disposeRuntime Also dispose the entire runtime? (default: false)
   */
  async dispose(sessionId: string | null = null, disposeRuntime: boolean = false): Promise<void> {
    const targetId = sessionId ?? this.registry.getActive()?.id;

    if (!targetId) {
      throw new Error('No session specified and no active session');
    }

    const meta = this.registry.get(targetId);
    if (!meta) {
      throw new Error(`Session not found: ${targetId}`);
    }

    // If disposing the active session, switch away first
    if (meta.isActive && !disposeRuntime) {
      const parentMeta = this.registry.get(this.rootSessionId!);
      if (parentMeta && parentMeta.id !== targetId) {
        await this.switchTo(this.rootSessionId!);
      } else {
        // Try to switch to any other non-disposed session
        const alternatives = this.registry.list().filter((m) => m.id !== targetId);
        if (alternatives.length > 0) {
          await this.switchTo(alternatives[0].id);
        }
      }
    }

    // If disposing root and not disposing runtime, that's usually a bad idea
    if (meta.id === this.rootSessionId && !disposeRuntime) {
      throw new Error(
        'Cannot dispose parent session without disposing runtime. Use disposeRuntime=true if intended.'
      );
    }

    // Unregister from registry
    this.registry.unregister(targetId, 'user_request');

    // If disposeRuntime flag, dispose entire runtime
    if (disposeRuntime) {
      await this.runtime.dispose();
      this.registry.clear();
      console.log('🗑️ Runtime and all sessions disposed');
    } else {
      console.log(`🗑️ Disposed session: ${targetId}`);
    }
  }

  /**
   * Rename a session
   */
  rename(sessionId: string, name: string): SessionMetadata | null {
    return this.registry.update(sessionId, { name });
  }

  /**
   * Add tags to a session
   */
  addTags(sessionId: string, ...tags: string[]): SessionMetadata | null {
    const meta = this.registry.get(sessionId);
    if (!meta) return null;
    const newTags = [...new Set([...meta.tags, ...tags])];
    return this.registry.update(sessionId, { tags: newTags });
  }

  /**
   * Remove tags from a session
   */
  removeTags(sessionId: string, ...tags: string[]): SessionMetadata | null {
    const meta = this.registry.get(sessionId);
    if (!meta) return null;
    const newTags = meta.tags.filter((t) => !tags.includes(t));
    return this.registry.update(sessionId, { tags: newTags });
  }

  /**
   * Get session by ID
   */
  get(sessionId: string): SessionMetadata | null {
    return this.registry.get(sessionId);
  }

  /**
   * List all sessions
   */
  list(options?: { includeDisposed?: boolean }): SessionMetadata[] {
    return this.registry.list(options);
  }

  /**
   * Get active session
   */
  getActive(): SessionMetadata | null {
    return this.registry.getActive();
  }

  /**
   * Get the root/parent session
   */
  getRoot(): SessionMetadata | null {
    return this.rootSessionId ? this.registry.get(this.rootSessionId) : null;
  }

  /**
   * Get all child sessions of the root
   */
  getChildren(): SessionMetadata[] {
    return this.rootSessionId ? this.registry.getChildren(this.rootSessionId) : [];
  }

  /**
   * Get session tree structure
   */
  getTree(): { roots: SessionTreeNode[] } {
    return this.registry.getTree();
  }

  /**
   * Get session by file path
   */
  findByFilePath(filePath: string): SessionMetadata | null {
    return this.registry.findByFilePath(filePath);
  }

  /**
   * Get operation history
   */
  getHistory(limit?: number): import('./registry.js').SessionHistoryEntry[] {
    return this.registry.getHistory(limit);
  }

  /**
   * Get diagnostics about the current state
   */
  getDiagnostics(): {
    totalSessions: number;
    activeSessionId: string | null;
    rootSessionId: string | null;
    childCount: number;
    disposedCount: number;
    historySize: number;
  } {
    const all = this.registry.list({ includeDisposed: true });
    const nonDisposed = this.registry.list();
    return {
      totalSessions: all.length,
      activeSessionId: this.registry.getActive()?.id ?? null,
      rootSessionId: this.rootSessionId,
      childCount: this.registry.getChildren(this.rootSessionId!).length,
      disposedCount: all.length - nonDisposed.length,
      historySize: this.registry.getHistory().length,
    };
  }

  /**
   * Export all session metadata as JSON (for debugging)
   */
  exportMetadata(): unknown {
    return {
      sessions: this.registry.list({ includeDisposed: true }).map((m) => ({
        id: m.id,
        filePath: m.filePath,
        parentId: m.parentId,
        createdAt: m.createdAt.toISOString(),
        name: m.name,
        tags: m.tags,
        state: m.state,
        isActive: m.isActive,
      })),
      rootSessionId: this.rootSessionId,
      activeSessionId: this.registry.getActive()?.id ?? null,
      tree: this.registry.getTree(),
    };
  }

  /**
   * Clear all non-disposed sessions (for testing)
   */
  async clearAll(): Promise<void> {
    const sessions = this.registry.list();
    for (const session of sessions) {
      await this.dispose(session.id);
    }
  }
}

/**
 * Tree node representation
 */
export interface SessionTreeNode {
  session: SessionMetadata;
  children: SessionTreeNode[];
}
