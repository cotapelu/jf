#!/usr/bin/env node

/**
 * State Manager for Commands
 *
 * Quản lý state lifecycle cho mỗi command trong mỗi session:
 * - Create/Lazy load state
 * - Restore từ session tree hoặc file
 * - Auto-save khi dirty
 * - Mutex locking
 * - Subscribe/notify cho updates
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Mutex } from "./utils/mutex.js";
// import { withFileMutationQueue } from "@earendil-works/pi-coding-agent"; // unused
// import { join } from "path"; // unused

/**
 * Base State Interface
 * Mọi command state class nên extend hoặc implement interface này.
 */
export interface CommandState {
  /** Đánh dấu state đã thay đổi (cần save) */
  isDirty: boolean;
  /** Mutex để lock khi cập nhật state */
  mutex?: Mutex;
  /** Listeners cho state changes (renderer updates) */
  listeners?: Set<() => void>;
  /** File path để persist (nếu có) */
  _filePath?: string;

  /** Set dirty flag và notify listeners */
  markDirty(): void;
  /** Subscribe to changes */
  subscribe(listener: () => void): () => void;
  /** Save state to file (nếu có filePath) */
  save(ctx: ExtensionContext): Promise<void>;
  /** Load state from file (nếu có filePath) */
  load(ctx: ExtensionContext): Promise<boolean>;
  /** Get snapshot (clone) */
  getSnapshot(): any;
}

/**
 * State Manager: Quản lý states cho tất cả commands trong 1 session
 */
export class StateManager {
  // Nested WeakMap: ctx → (commandName → state)
  private states = new WeakMap<ExtensionContext, Map<string, CommandState>>();
  private execCtx: any; // Reference to executor for callbacks

  constructor(executorCtx?: any) {
    this.execCtx = executorCtx;
  }

  /**
   * Get or create state cho command trong context
   */
  getOrCreateState(
    commandName: string,
    ctx: ExtensionContext,
    StateClass?: new () => CommandState,
    persistencePath?: (ctx: ExtensionContext, commandName: string) => string
  ): CommandState {
    let ctxStates = this.states.get(ctx);
    if (!ctxStates) {
      ctxStates = new Map();
      this.states.set(ctx, ctxStates);
    }

    if (!ctxStates.has(commandName)) {
      let state: CommandState;

      if (StateClass) {
        // Create new instance
        state = new StateClass();
      } else {
        // Generic state (for simple commands)
        state = createGenericState();
      }

      // Setup file persistence nếu có persistencePath
      if (persistencePath) {
        state._filePath = persistencePath(ctx, commandName);
      }

      // Initial dirty = false
      state.isDirty = false;

      ctxStates.set(commandName, state);
    }

    return ctxStates.get(commandName)!;
  }

  /**
   * Restore state cho command từ session tree hoặc file
   */
  async restoreState(
    commandName: string,
    ctx: ExtensionContext,
    StateClass?: new () => CommandState,
    persistencePath?: (ctx: ExtensionContext, commandName: string) => string
  ): Promise<boolean> {
    const state = this.getOrCreateState(commandName, ctx, StateClass, persistencePath);

    // Try load từ file
    if (state._filePath) {
      try {
        const loaded = await state.load(ctx);
        if (loaded) {
          state.isDirty = false;
          return true;
        }
      } catch (error) {
        console.error(`[StateManager] Failed to load state for ${commandName}:`, error);
      }
    }

    // Fresh state
    return false;
  }

  /**
   * Save state nếu dirty
   */
  async saveStateIfDirty(commandName: string, ctx: ExtensionContext): Promise<void> {
    const state = this.getState(commandName, ctx);
    if (!state) return;

    if (!state.isDirty) return;

    try {
      // Save to file
      if (state._filePath) {
        await state.save(ctx);
      }

      state.isDirty = false;
    } catch (error) {
      console.error(`[StateManager] Failed to save state for ${commandName}:`, error);
    }
  }

  /**
   * Save tất cả dirty states
   */
  async saveAllDirty(ctx: ExtensionContext): Promise<void> {
    const ctxStates = this.states.get(ctx);
    if (!ctxStates) return;

    const promises: Promise<void>[] = [];
    for (const [commandName, state] of ctxStates.entries()) {
      if (state.isDirty) {
        promises.push(this.saveStateIfDirty(commandName, ctx));
      }
    }
    await Promise.all(promises);
  }

  /**
   * Get state cho command
   */
  getState(commandName: string, ctx: ExtensionContext): CommandState | undefined {
    const ctxStates = this.states.get(ctx);
    return ctxStates?.get(commandName);
  }

  /**
   * Check if state exists
   */
  hasState(commandName: string, ctx: ExtensionContext): boolean {
    return this.getState(commandName, ctx) !== undefined;
  }

  /**
   * Mark state as dirty (trigger auto-save later)
   */
  markDirty(commandName: string, ctx: ExtensionContext): void {
    const state = this.getState(commandName, ctx);
    if (state) state.markDirty();
  }

  /**
   * Clear all states cho context ( khi session end)
   */
  clearContext(ctx: ExtensionContext): void {
    const ctxStates = this.states.get(ctx);
    if (ctxStates) {
      // Save all dirty trước khi clear
      this.saveAllDirty(ctx).catch(console.error);
      ctxStates.clear();
    }
  }

  /**
   * Get all command names có state trong ctx
   */
  getCommandNames(ctx: ExtensionContext): string[] {
    const ctxStates = this.states.get(ctx);
    return ctxStates ? Array.from(ctxStates.keys()) : [];
  }

  /**
   * Get state stats (for debugging)
   */
  getStats(ctx: ExtensionContext): { commandCount: number; dirtyCount: number } {
    const ctxStates = this.states.get(ctx);
    if (!ctxStates) return { commandCount: 0, dirtyCount: 0 };

    let dirty = 0;
    for (const state of ctxStates.values()) {
      if (state.isDirty) dirty++;
    }
    return { commandCount: ctxStates.size, dirtyCount: dirty };
  }
}

/**
 * Factory: create generic state (for commands without custom state class)
 */
function createGenericState(): CommandState {
  let _dirty = false;
  const _listeners = new Set<() => void>();

  return {
    get isDirty() { return _dirty; },
    set isDirty(val: boolean) { _dirty = val; if (val) { for (const l of _listeners) l(); } },
    listeners: _listeners,

    markDirty() {
      _dirty = true;
      for (const l of _listeners) l();
    },

    subscribe(listener: () => void): () => void {
      _listeners.add(listener);
      return () => _listeners.delete(listener);
    },

    async save(_ctx: ExtensionContext): Promise<void> {
      // Generic state không persist
    },

    async load(_ctx: ExtensionContext): Promise<boolean> {
      return false;
    },

    getSnapshot() {
      return { isDirty: _dirty };
    }
  };
}

// Singleton per executor instance
let globalStateManager: StateManager | null = null;

export function getStateManager(executorCtx?: any): StateManager {
  if (!globalStateManager) {
    globalStateManager = new StateManager(executorCtx);
  }
  return globalStateManager;
}

export function resetStateManager(): void {
  globalStateManager = null;
}
