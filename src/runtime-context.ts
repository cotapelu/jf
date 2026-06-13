/**
 * Global runtime context for tools that need access to the current AgentSessionRuntime.
 *
 * When the runtime is created, call setCurrentRuntime(runtime).
 * Tools can then call getCurrentRuntime() to access it.
 */

import type { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";

let currentRuntime: AgentSessionRuntime | null = null;

/**
 * Set the current runtime for the session manager tool.
 * Call this after creating the runtime (e.g., in main.ts).
 */
export function setCurrentRuntime(runtime: AgentSessionRuntime | null): void {
    currentRuntime = runtime;
}

/**
 * Get the current runtime. Throws if not set.
 */
export function getCurrentRuntime(): AgentSessionRuntime {
    if (!currentRuntime) {
        throw new Error(
            "Runtime not set. This tool requires an active runtime context. " +
            "Make sure to call setCurrentRuntime() after creating the runtime.",
        );
    }
    return currentRuntime;
}

/**
 * Clear the current runtime (e.g., on dispose).
 */
export function clearCurrentRuntime(): void {
    currentRuntime = null;
}
