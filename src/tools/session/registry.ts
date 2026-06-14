import type { AgentSession } from '@earendil-works/pi-coding-agent';

/**
 * Session metadata tracked in the registry
 */
export interface SessionMetadata {
  /** Unique identifier (derived from session file or generated) */
  id: string;
  /** Full path to the session JSONL file */
  filePath: string;
  /** Parent session ID (null for root/original) */
  parentId: string | null;
  /** When this session was created */
  createdAt: Date;
  /** User-provided name (may be undefined) */
  name: string | undefined;
  /** Tags for categorization */
  tags: string[];
  /** Current state: 'active', 'inactive', 'disposed' */
  state: SessionState;
  /** Reference to the actual AgentSession (if still alive) */
  sessionRef: WeakRef<AgentSession> | null;
  /** Whether this session is the current active session in the runtime */
  isActive: boolean;
}

/**
 * Session state enumeration
 */
export enum SessionState {
  /** Session is currently active in runtime */
  ACTIVE = 'active',
  /** Session exists but is not currently active */
  INACTIVE = 'inactive',
  /** Session has been disposed and should be removed */
  DISPOSED = 'disposed',
}

/**
 * Operations that can be performed on sessions
 */
export type SessionOperation =
  | 'create'
  | 'switch'
  | 'dispose'
  | 'rename'
  | 'tag_add'
  | 'tag_remove'
  | 'update_state';

/**
 * Session history entry for audit trail
 */
export interface SessionHistoryEntry {
  timestamp: Date;
  operation: SessionOperation;
  sessionId: string;
  details: Record<string, unknown>;
  actor: 'user' | 'system' | 'tool';
}

/**
 * Extended session operation types for internal use
 */
type InternalSessionOperation = SessionOperation | 'update';

/**
 * SessionRegistry - Central registry for tracking ALL sessions in a runtime lifecycle
 *
 * Features:
 * - Tracks all sessions with rich metadata
 * - Maintains weak references to avoid memory leaks
 * - Provides atomic operations with validation
 * - Records history for debugging/auditing
 * - Thread-safe for single-threaded JS (no actual concurrency, but careful state management)
 *
 * Usage:
 * ```typescript
 * const registry = new SessionRegistry();
 * const meta = await registry.register(session, { name: "child-1" });
 * const all = registry.list();
 * const active = registry.getActive();
 * await registry.unregister(sessionId, "disposed");
 * ```
 */
export class SessionRegistry {
  /** Map of session ID -> metadata */
  private readonly sessions: Map<string, SessionMetadata> = new Map();

  /** Session ID -> parent ID mapping for tree structure */
  private readonly parentMap: Map<string, string | null> = new Map();

  /** Active session ID (only one at a time) */
  private activeSessionId: string | null = null;

  /** History of operations */
  private readonly history: SessionHistoryEntry[] = [];

  /** Counter for generating unique IDs */
  private idCounter = 0;

  /**
   * Register a new session with optional metadata
   * @param session The AgentSession instance
   * @param options Optional metadata (name, tags, parentId)
   * @returns The created SessionMetadata
   */
  register(
    session: AgentSession,
    options: {
      name?: string;
      tags?: string[];
      parentId?: string | null;
    } = {}
  ): SessionMetadata {
    const sessionId = this.generateSessionId(session);
    const filePath = session.sessionFile ?? undefined;

    if (this.sessions.has(sessionId)) {
      throw new Error(`Session already registered: ${sessionId}`);
    }

    const metadata: SessionMetadata = {
      id: sessionId,
      filePath: filePath!,
      parentId: options.parentId ?? null,
      createdAt: new Date(),
      name: options.name,
      tags: options.tags ?? [],
      state: SessionState.ACTIVE,
      sessionRef: new WeakRef(session),
      isActive: true,
    };

    this.sessions.set(sessionId, metadata);
    this.parentMap.set(sessionId, options.parentId ?? null);

    if (this.activeSessionId !== null) {
      // Deactivate previous active session
      const previous = this.sessions.get(this.activeSessionId);
      if (previous) {
        previous.isActive = false;
        previous.state = SessionState.INACTIVE;
      }
    }
    this.activeSessionId = sessionId;

    this.recordHistory('create', sessionId, { name: options.name, tags: options.tags });

    return metadata;
  }

  /**
   * Update metadata for an existing session
   */
  update(
    sessionId: string,
    updates: Partial<Pick<SessionMetadata, 'name' | 'tags'>>
  ): SessionMetadata | null {
    const meta = this.sessions.get(sessionId);
    if (!meta) return null;

    if (updates.name !== undefined) meta.name = updates.name;
    if (updates.tags !== undefined) meta.tags = updates.tags;

    this.recordHistory('update', sessionId, updates);
    return meta;
  }

  /**
   * Set the active session
   */
  setActive(sessionId: string): boolean {
    const meta = this.sessions.get(sessionId);
    if (!meta || meta.state === SessionState.DISPOSED) {
      return false;
    }

    // Deactivate current
    if (this.activeSessionId) {
      const current = this.sessions.get(this.activeSessionId);
      if (current) {
        current.isActive = false;
        if (current.state === SessionState.ACTIVE) {
          current.state = SessionState.INACTIVE;
        }
      }
    }

    meta.isActive = true;
    meta.state = SessionState.ACTIVE;
    this.activeSessionId = sessionId;

    this.recordHistory('switch', sessionId, { from: this.activeSessionId });
    return true;
  }

  /**
   * Unregister a session (mark as disposed)
   */
  unregister(sessionId: string, reason?: string): boolean {
    const meta = this.sessions.get(sessionId);
    if (!meta) return false;

    meta.state = SessionState.DISPOSED;
    meta.isActive = false;
    meta.sessionRef = null;

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    this.recordHistory('dispose', sessionId, { reason });
    return true;
  }

  /**
   * Get metadata by session ID
   */
  get(sessionId: string): SessionMetadata | null {
    const meta = this.sessions.get(sessionId);
    if (!meta) return null;
    if (meta.state === SessionState.DISPOSED) return null;
    return meta;
  }

  /**
   * Get all sessions (excluding disposed unless requested)
   */
  list(options: { includeDisposed?: boolean } = {}): SessionMetadata[] {
    const result: SessionMetadata[] = [];
    for (const meta of this.sessions.values()) {
      if (options.includeDisposed || meta.state !== SessionState.DISPOSED) {
        result.push(meta);
      }
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get child sessions of a parent
   */
  getChildren(parentId: string): SessionMetadata[] {
    return this.list().filter((m) => m.parentId === parentId && m.state !== SessionState.DISPOSED);
  }

  /**
   * Get the currently active session
   */
  getActive(): SessionMetadata | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) ?? null;
  }

  /**
   * Build a tree structure of sessions (parent -> children)
   */
  getTree(): { roots: SessionTreeNode[] } {
    const nodes = new Map<string, SessionTreeNode>();

    // Create all nodes first
    for (const meta of this.sessions.values()) {
      nodes.set(meta.id, {
        session: meta,
        children: [],
      });
    }

    // Build tree
    const roots: SessionTreeNode[] = [];
    for (const node of nodes.values()) {
      const parentId = node.session.parentId;
      if (parentId && nodes.has(parentId)) {
        nodes.get(parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return { roots };
  }

  /**
   * Get session by file path
   */
  findByFilePath(filePath: string): SessionMetadata | null {
    for (const meta of this.sessions.values()) {
      if (meta.filePath === filePath && meta.state !== SessionState.DISPOSED) {
        return meta;
      }
    }
    return null;
  }

  /**
   * Check if a session ID exists
   */
  has(sessionId: string): boolean {
    const meta = this.sessions.get(sessionId);
    return meta !== undefined && meta.state !== SessionState.DISPOSED;
  }

  /**
   * Clear all sessions (for testing/disposal)
   */
  clear(): void {
    this.sessions.clear();
    this.parentMap.clear();
    this.activeSessionId = null;
  }

  /**
   * Get operation history
   */
  getHistory(limit?: number): SessionHistoryEntry[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(session: AgentSession): string {
    // Try to derive from session file name first
    if (session.sessionFile) {
      // Extract filename and remove .jsonl extension without complex regex
      const parts = session.sessionFile.split('/').filter(Boolean);
      const filename = parts[parts.length - 1] || '';
      const base = filename
        .replace(/\.jsonl$/, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase();
      if (base) {
        return `session_${base}`;
      }
    }

    // Fallback to counter-based ID
    this.idCounter++;
    return `session_${Date.now()}_${this.idCounter}`;
  }

  /**
   * Record an operation in history
   */
  private recordHistory(
    operation: InternalSessionOperation,
    sessionId: string,
    details: Record<string, unknown>
  ): void {
    this.history.push({
      timestamp: new Date(),
      operation: operation as SessionOperation, // Cast để lưu internal ops
      sessionId,
      details,
      actor: 'system',
    });
  }

  /** Get count of all non-disposed sessions */
  get count(): number {
    return this.list().length;
  }

  /** Get count of active sessions (should be 0 or 1) */
  get activeCount(): number {
    return this.activeSessionId ? 1 : 0;
  }
}

/**
 * Tree node for session hierarchy
 */
export interface SessionTreeNode {
  session: SessionMetadata;
  children: SessionTreeNode[];
}
