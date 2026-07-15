/**
 * AgentWorkspace encapsulates shared workspace operations for a team.
 * Provides thread-safe (via external lock) access to the SharedWorkspace.
 */
import { SharedWorkspace } from "./workspace.js";

export class AgentWorkspace {
  constructor(private readonly workspace: SharedWorkspace) {}

  /**
   * Clears the entire workspace.
   */
  clear(): void {
    this.workspace.clear();
  }

  /**
   * Writes a key-value pair to the shared workspace.
   * @param key - Workspace key.
   * @param value - Value to store.
   * @param owner - Agent ID that owns this write.
   */
  set(key: string, value: unknown, owner: string): void {
    this.workspace.set(key, value, owner);
  }

  /**
   * Reads a value from the shared workspace.
   * @param key - Workspace key.
   * @returns The stored value, or undefined if not present.
   */
  get(key: string): unknown {
    return this.workspace.get(key);
  }

  /**
   * Gets a full workspace entry (includes metadata).
   * @param key - Workspace key.
   * @returns Entry or undefined.
   */
  getEntry(key: string): { value: unknown; owner: string; timestamp: number } | undefined {
    return this.workspace.getEntry(key);
  }

  /**
   * Lists all keys in the workspace.
   * @returns Array of keys.
   */
  list(): string[] {
    return this.workspace.list();
  }

  /**
   * Lists keys with a specific prefix.
   * @param prefix - Prefix to filter by.
   * @returns Array of matching keys.
   */
  listByPrefix(prefix: string): string[] {
    return this.workspace.listByPrefix(prefix);
  }

  /**
   * Deletes a key from the workspace.
   * @param key - Key to delete.
   * @returns True if key existed and was deleted.
   */
  delete(key: string): boolean {
    return this.workspace.delete(key);
  }

  /**
   * Returns the entire workspace as a plain object.
   * @returns Object mapping keys to values.
   */
  toObject(): Record<string, unknown> {
    return this.workspace.toObject();
  }

  /**
   * Provides direct access to the underlying SharedWorkspace instance.
   * Used for backward compatibility (e.g., tests that need the raw workspace).
   * @returns The SharedWorkspace.
   */
  get underlying(): SharedWorkspace {
    return this.workspace;
  }
}
