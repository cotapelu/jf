/**
 * Shared Workspace for Team Collaboration
 * In-memory key-value store accessible by all team members
 */
export interface WorkspaceEntry {
  value: unknown;
  owner: string;
  timestamp: number;
}

export class SharedWorkspace {
  private data: Map<string, WorkspaceEntry> = new Map();

  /**
   * Write a key-value pair to workspace
   */
  set(key: string, value: unknown, owner: string): void {
    this.data.set(key, {
      value,
      owner,
      timestamp: Date.now(),
    });
  }

  /**
   * Read a value from workspace
   */
  get(key: string): unknown {
    const entry = this.data.get(key);
    return entry?.value;
  }

  /**
   * Get entry metadata
   */
  getEntry(key: string): WorkspaceEntry | undefined {
    return this.data.get(key);
  }

  /**
   * List all keys
   */
  list(): string[] {
    return Array.from(this.data.keys());
  }

  /**
   * List keys by prefix
   */
  listByPrefix(prefix: string): string[] {
    return this.list().filter(k => k.startsWith(prefix));
  }

  /**
   * Delete a key
   */
  delete(key: string): boolean {
    return this.data.delete(key);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Get all entries as plain object
   */
  toObject(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [key, entry] of this.data) {
      obj[key] = entry.value;
    }
    return obj;
  }
}
