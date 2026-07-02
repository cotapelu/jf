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
 * Need only agent dir?                → getCurrentAgentDir()
 * Need only current model?            → getCurrentModel()
 * Need extension runner?              → getCurrentExtensionRunner()
 * Need session manager?              → getCurrentSessionManager()
 * Need session file?                  → getCurrentSessionFile()
 * Need session ID?                    → getCurrentSessionId()
 * Need active tool names?             → getCurrentActiveToolNames()
 * Need all tools?                     → getCurrentAllTools()
 * Need tool definition by name?       → getCurrentToolDefinition(name)
 * Need all messages?                  → getCurrentMessages()
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

import type { AgentSessionRuntime, AgentSession, AgentSessionServices, AgentSessionRuntimeDiagnostic, ToolDefinition, ExtensionRunner, SessionManager, ToolInfo } from '@earendil-works/pi-coding-agent';
import type { Model } from '@earendil-works/pi-ai';

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
 * Get the agent directory from services.
 */
export function getCurrentAgentDir(): string {
  return getCurrentServices().agentDir;
}

/**
 * Get current model from session (may be undefined if not selected yet).
 */
export function getCurrentModel(): Model<any> | undefined {
  return getCurrentSession().model;
}

/**
 * Get the current model's API type (for provider selection).
 */
export function getCurrentModelApi(): any {
  return getCurrentModel()?.api;
}

/**
 * Get extension runner from session.
 */
export function getCurrentExtensionRunner(): ExtensionRunner {
  return getCurrentSession().extensionRunner;
}

/**
 * Get session manager from current session (not services).
 */
export function getCurrentSessionManager(): SessionManager {
  return getCurrentSession().sessionManager;
}

/**
 * Get current session file path (undefined if sessions disabled).
 */
export function getCurrentSessionFile(): string | undefined {
  return getCurrentSession().sessionFile;
}

/**
 * Get current session ID.
 */
export function getCurrentSessionId(): string {
  return getCurrentSession().sessionId;
}

/**
 * Get current session display name.
 */
export function getCurrentSessionName(): string | undefined {
  return getCurrentSession().sessionName;
}

/**
 * Get active tool names from current session.
 */
export function getCurrentActiveToolNames(): string[] {
  return getCurrentSession().getActiveToolNames();
}

/**
 * Get all configured tools from current session (returns ToolInfo, not ToolDefinition).
 * Use getCurrentToolDefinition(name) for ToolDefinition.
 */
export function getCurrentToolInfoList(): ToolInfo[] {
  return getCurrentSession().getAllTools();
}

/**
 * Get tool definition by name from current session.
 */
export function getCurrentToolDefinition(name: string): ToolDefinition | undefined {
  return getCurrentSession().getToolDefinition(name);
}

/**
 * Get all messages from current session.
 */
export function getCurrentMessages(): any[] {
  return getCurrentSession().messages;
}

/**
 * Get model fallback message (if any) from the runtime.
 */
export function getCurrentModelFallbackMessage(): string | undefined {
  return getCurrentRuntime().modelFallbackMessage;
}

/**
 * Get auth storage from services.
 */
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
