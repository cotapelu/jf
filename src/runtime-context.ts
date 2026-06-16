/**
 * Global runtime context for tools that need access to the current AgentSessionRuntime.
 *
 * ==================== ARCHITECTURE OVERVIEW ====================
 *
 * The Pi SDK creates a hierarchy of objects:
 *
 *   createAgentSessionServices() → AgentSessionServices
 *     ├─ cwd: string
 *     ├─ agentDir: string
 *     ├─ authStorage: AuthStorage
 *     ├─ settingsManager: SettingsManager
 *     ├─ modelRegistry: ModelRegistry
 *     ├─ resourceLoader: ResourceLoader
 *     └─ diagnostics: RuntimeDiagnostics[]
 *
 *   createAgentSessionFromServices() → AgentSession (in CreateAgentSessionResult)
 *     ├─ messages: Message[]
 *     ├─ sessionFile: string
 *     └─ ... (other session state)
 *
 *   createAgentSessionRuntime() → AgentSessionRuntime (combines both)
 *     ├─ session: AgentSession (from above)
 *     ├─ services: AgentSessionServices (from above)
 *     ├─ cwd: string
 *     ├─ diagnostics: RuntimeDiagnostics[]
 *     └─ modelFallbackMessage?: string
 *
 * ==================== HOW TO ACCESS ====================
 *
 * 1️⃣ Get the FULL runtime object (everything):
 *    const runtime = getCurrentRuntime();
 *    → runtime.session (AgentSession)
 *    → runtime.services (AgentSessionServices)
 *    → runtime.cwd (string)
 *    → runtime.diagnostics (Diagnostics[])
 *    → runtime.modelFallbackMessage (string | undefined)
 *
 * 2️⃣ Get SPECIFIC parts via convenience getters (recommended):
 *    const session = getCurrentSession();              // Same as runtime.session
 *    const services = getCurrentServices();            // Same as runtime.services
 *    const cwd = getCurrentCwd();                      // Same as runtime.cwd
 *    const auth = getCurrentAuthStorage();             // Same as runtime.services.authStorage
 *    const settings = getCurrentSettingsManager();    // Same as runtime.services.settingsManager
 *    const models = getCurrentModelRegistry();        // Same as runtime.services.modelRegistry
 *    const loader = getCurrentResourceLoader();       // Same as runtime.services.resourceLoader
 *
 * ==================== DECISION TREE ====================
 *
 * Need the entire runtime object?     → getCurrentRuntime()
 * Need only the session?              → getCurrentSession()
 * Need only services?                 → getCurrentServices()
 * Need only auth storage?             → getCurrentAuthStorage()
 * Need only settings manager?         → getCurrentSettingsManager()
 * Need only model registry?           → getCurrentModelRegistry()
 * Need only resource loader?          → getCurrentResourceLoader()
 * Need only cwd?                      → getCurrentCwd()
 *
 * RULE OF THUMB: Use the most specific getter available. Only use
 * getCurrentRuntime() if you need 2+ properties from it.
 *
 * ==================== LIFECYCLE ====================
 *
 * • In main.ts: After creating runtime, call setCurrentRuntime(runtime)
 * • In tools: Call any getCurrent*() function to access components
 * • On shutdown: Call clearCurrentRuntime() to avoid memory leaks
 *
 * ==================== IMPORTANT ====================
 *
 * • All getters throw if runtime is not set (except clearCurrentRuntime)
 * • All getters are O(1) - just property access
 * • Session is from createAgentSessionFromServices(), NOT from services
 * • Services is from createAgentSessionServices(), NOT from runtime
 *
 * When the runtime is created, call setCurrentRuntime(runtime).
 * Tools can then call getCurrentRuntime() to access it.
 */

import type { AgentSessionRuntime, AgentSession, AgentSessionServices, AgentSessionRuntimeDiagnostic } from '@earendil-works/pi-coding-agent';

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
      'Runtime not set. This tool requires an active runtime context. ' +
        'Make sure to call setCurrentRuntime() after creating the runtime.'
    );
  }
  return currentRuntime;
}

/**
 * Get the current session from the runtime.
 */
export function getCurrentSession(): AgentSession {
  return getCurrentRuntime().session;
}

/**
 * Get the current services from the runtime.
 */
export function getCurrentServices(): AgentSessionServices {
  return getCurrentRuntime().services;
}

/**
 * Get the current working directory from the runtime.
 */
export function getCurrentCwd(): string {
  return getCurrentRuntime().cwd;
}

/**
 * Get diagnostics from the runtime.
 */
export function getCurrentDiagnostics(): readonly AgentSessionRuntimeDiagnostic[] {
  return getCurrentRuntime().diagnostics;
}

/**
 * Get model fallback message (if any) from the runtime.
 */
export function getCurrentModelFallbackMessage(): string | undefined {
  return getCurrentRuntime().modelFallbackMessage;
}

export function getCurrentAuthStorage(): any {
  return getCurrentServices().authStorage;
}

/**
 * Get the settings manager from the current runtime's services.
 */
export function getCurrentSettingsManager(): any {
  return getCurrentServices().settingsManager;
}

/**
 * Get the model registry from the current runtime's services.
 */
export function getCurrentModelRegistry(): any {
  return getCurrentServices().modelRegistry;
}

/**
 * Get the resource loader from the current runtime's services.
 */
export function getCurrentResourceLoader(): any {
  return getCurrentServices().resourceLoader;
}

/**
 * Clear the current runtime (e.g., on dispose).
 */
export function clearCurrentRuntime(): void {
  currentRuntime = null;
}
