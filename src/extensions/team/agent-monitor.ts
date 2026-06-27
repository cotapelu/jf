/**
 * Agent Monitor
 *
 * Handles agent lifecycle: heartbeat tracking, status management, zombie detection.
 * Extracted from AgentTeam for single responsibility.
 */

import type { AgentToolResult } from "@earendil-works/pi-coding-agent";
import { TaskManager } from "./task-manager.js";

export interface AgentStatus {
  currentTaskIndex: number | null;
  status: 'idle' | 'working';
}

export interface AgentMonitorOptions {
  agentTimeoutMs?: number; // How long before agent considered zombie (default 2min)
}

const DEFAULT_AGENT_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * AgentMonitor: tracks agent heartbeats and detects zombies.
 * - Not responsible for task logic (uses TaskManager to reclaim tasks)
 */
export class AgentMonitor {
  // Mutable for test access
  agentStatuses: Map<string, AgentStatus> = new Map();
  agentLastSeen: Map<string, number> = new Map();
  roleByAgentId: Map<string, string> = new Map(); // session.id -> role
  private taskManager: TaskManager;
  private agentTimeoutMs: number;
  private onUpdate?: (update: AgentToolResult<unknown>) => void;

  constructor(taskManager: TaskManager, options: AgentMonitorOptions = {}) {
    this.taskManager = taskManager;
    this.agentTimeoutMs = options.agentTimeoutMs ?? DEFAULT_AGENT_TIMEOUT_MS;
  }

  setOnUpdate(fn: ((update: AgentToolResult<unknown>) => void) | undefined): void {
    this.onUpdate = fn;
  }

  // Register an agent with a role (called when runtime created)
  registerAgent(sessionId: string, role: string): void {
    this.roleByAgentId.set(sessionId, role);
    this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
  }

  // Unregister an agent (called when agent disposed)
  unregisterAgent(sessionId: string): void {
    const role = this.roleByAgentId.get(sessionId);
    if (role) {
      this.agentStatuses.delete(role);
      this.agentLastSeen.delete(role);
      this.roleByAgentId.delete(sessionId);
    }
  }

  // Update heartbeat for a role (agent is alive)
  updateHeartbeat(role: string): void {
    this.agentLastSeen.set(role, Date.now());
  }

  // Get agent status by role
  getAgentStatus(role: string): AgentStatus | undefined {
    return this.agentStatuses.get(role);
  }

  // Set agent status (used by team when task assigned/completed)
  setAgentStatus(role: string, status: AgentStatus): void {
    this.agentStatuses.set(role, status);
  }

  // Detect zombie agents and reclaim their tasks
  reclaimZombieAgents(): void {
    const now = Date.now();
    const zombies: string[] = [];

    for (const [role, lastSeen] of this.agentLastSeen.entries()) {
      const status = this.agentStatuses.get(role);
      if (status && status.status === 'working' && now - lastSeen > this.agentTimeoutMs) {
        zombies.push(role);
      }
    }

    if (zombies.length === 0) return;

    for (const role of zombies) {
      // Reset agent status
      this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
      this.agentLastSeen.delete(role);

      // Reclaim tasks from this zombie agent via TaskManager
      this.taskManager.reclaimZombieTasks(role, now);
    }
  }

  // Clear all state (for reset/cleanup)
  resetAll(): void {
    this.agentStatuses.clear();
    this.agentLastSeen.clear();
    // Keep registrations (roleByAgentId) intact
    // Re-initialize idle status for all registered roles
    for (const role of this.roleByAgentId.values()) {
      this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
    }
  }

  clear(): void {
    this.agentStatuses.clear();
    this.agentLastSeen.clear();
    this.roleByAgentId.clear();
  }

  // Get all registered roles (for debugging/inspection)
  getRoles(): string[] {
    return Array.from(this.agentStatuses.keys());
  }
}
