/**
 * Minimal Team Manager
 *
 * Simple task distribution and shared workspace for multi-agent collaboration.
 */

import {
  AgentSessionRuntime,
  createAgentSessionRuntime,
  createAgentSessionServices,
  createAgentSessionFromServices,
  // SessionManager unused - removed
  type AgentToolResult,
  type CreateAgentSessionRuntimeFactory,
  type CreateAgentSessionRuntimeResult,
  type SessionStartEvent,
  // type ToolDefinition unused - removed
  // type AgentSession unused - removed
} from "@earendil-works/pi-coding-agent";
// import { getAgentDir } from "@earendil-works/pi-coding-agent"; // unused
import { SharedWorkspace, type WorkspaceEntry } from "./workspace.js";
import { createTeamOpsTool } from "./team-ops-tool.js";
import { TaskManager } from "./task-manager.js";
import { AgentMonitor } from "./agent-monitor.js";
import * as path from "node:path";

export const MAX_TEAM_SIZE = 4;
const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 60000; // 60 seconds
const AGENT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes for zombie detection

function calculateRetryDelay(retryCount: number): number {
  const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount - 1);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

export function validateOptions(teamSize: number, teamRoles: string[]): { size: number; roles: string[] } {
  const size = Math.max(1, Math.min(teamSize, MAX_TEAM_SIZE));
  const roles: string[] = [];
  for (let i = 0; i < size; i++) {
    roles.push(teamRoles[i] ?? `agent-${i + 1}`);
  }
  return { size, roles };
}

export interface AgentTeamRuntime {
  runtimes: AgentSessionRuntime[];
  size: number;
  roles: string[];
  dispose: () => Promise<void>;
}

export class AgentTeam implements AgentTeamRuntime {
  id: string = '';
  runtimes: AgentSessionRuntime[] = [];
  roles: string[] = [];
  size = 0;
  private taskManager: TaskManager;
  private agentMonitor: AgentMonitor;
  dispose: () => Promise<void>;
  childPromises: Promise<void>[] = [];
  private childControllers: Map<string, AbortController> = new Map();
  private disposed = false;

  private workspace: SharedWorkspace;
  private messageBus: Map<string, Array<{ from: string; content: string; timestamp: number }>> = new Map();
  private lockQueue: (() => void)[] = [];
  private locked = false;
  monitorInterval: NodeJS.Timeout | null = null;
  private onUpdate?: (update: AgentToolResult<unknown>) => void;

  public notifyUpdate(update: AgentToolResult<unknown>): void {
    if (this.onUpdate) {
      try {
        this.onUpdate(update);
      } catch (e) {
        // Ignore update errors - don't break team execution
        console.warn('Failed to send update:', e);
      }
    }
  }

  // Helper to create consistent update format
  public createUpdate(content: string, details?: unknown, isError?: boolean): AgentToolResult<unknown> {
    return {
      content: [{ type: "text", text: content }],
      details,
      isError: isError || false
    };
  }

  // Locking mechanism for concurrency control

  constructor() {
    this.dispose = async () => {
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = null;
      }
      this.disposed = true;
      for (const controller of this.childControllers.values()) {
        controller.abort();
      }
      if (this.childPromises && this.childPromises.length > 0) {
        await Promise.allSettled(this.childPromises);
      }
      this.childControllers.clear();
      this.childPromises = [];
      await Promise.allSettled(
        this.runtimes.map(rt =>
          (rt.dispose ? rt.dispose() : Promise.resolve()).catch(err =>
            console.error("Failed to dispose agent runtime:", err)
          )
        )
      );
      this.runtimes = [];
      this.agentMonitor.clear();
      try {
        const registry = TeamRegistry.getInstance();
        if (this.id) {
          registry.unregister(this.id);
        }
      } catch (e) {
        console.warn('Failed to unregister team from registry:', e);
      }
    };
    this.workspace = new SharedWorkspace();
    // Initialize TaskManager
    this.taskManager = new TaskManager({
      maxRetries: DEFAULT_MAX_RETRIES,
      baseRetryDelayMs: BASE_RETRY_DELAY_MS,
      maxRetryDelayMs: MAX_RETRY_DELAY_MS,
    });
    this.taskManager.setOnUpdate((update) => this.notifyUpdate(update));
    // Initialize AgentMonitor
    this.agentMonitor = new AgentMonitor(this.taskManager, { agentTimeoutMs: AGENT_TIMEOUT_MS });
    this.agentMonitor.setOnUpdate((update) => this.notifyUpdate(update));
  }

  setTeamId(id: string): void {
    this.id = id;
  }

  setOnUpdate(fn: ((update: AgentToolResult<unknown>) => void) | undefined): void {
    this.onUpdate = fn;
    // Also forward to TaskManager
    this.taskManager.setOnUpdate(fn);
  }

  // Expose tasks (for compatibility, e.g., team-ops-tool)
  get tasks(): string[] {
    return this.taskManager.getTasks();
  }
  set tasks(value: string[]) {
    this.taskManager.initialize(value);
  }

  // For tests that directly access internal state
  get taskStatuses(): Map<number, any> {
    return this.taskManager.getAllTaskStatuses();
  }

  get pendingIndices(): number[] {
    return this.taskManager.pendingIndices;
  }
  set pendingIndices(v: number[]) {
    this.taskManager.pendingIndices = v;
  }

  getWorkspace(): SharedWorkspace {
    return this.workspace;
  }

  // Backward compatibility for tests
  get agentStatuses(): Map<string, { currentTaskIndex: number | null; status: 'idle' | 'working' }> {
    return this.agentMonitor.agentStatuses;
  }
  get agentLastSeen(): Map<string, number> {
    return this.agentMonitor.agentLastSeen;
  }
  get roleByAgentId(): Map<string, string> {
    return this.agentMonitor.roleByAgentId;
  }

  // Locking mechanism for concurrency control
  private async acquireLock(): Promise<void> {
    return new Promise<void>(resolve => {
      this.lockQueue.push(resolve);
      if (!this.locked) this.runNext();
    });
  }

  private runNext(): void {
    if (this.lockQueue.length > 0) {
      this.locked = true;
      const next = this.lockQueue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }

  private releaseLock(): void {
    this.locked = false;
    this.runNext();
  }

  async withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    await this.acquireLock();
    try {
      return await fn();
    } finally {
      this.releaseLock();
    }
  }

  // Workspace operations with lock
  private async workspaceClear(): Promise<void> {
    this.workspace.clear();
  }

  async workspaceWrite(key: string, value: unknown, owner: string): Promise<void> {
    return this.withLock(() => {
      this.workspace.set(key, value, owner);
      // Notify workspace update
      this.notifyUpdate(this.createUpdate(
        `📝 ${owner} wrote to workspace: ${key}`,
        { key, owner, valuePreview: String(value).substring(0, 150) }
      ));
    });
  }

  async workspaceRead(key: string): Promise<unknown> {
    return this.withLock(() => this.workspace.get(key));
  }

  async workspaceGetEntry(key: string): Promise<WorkspaceEntry | undefined> {
    return this.withLock(() => this.workspace.getEntry(key));
  }

  async workspaceList(): Promise<string[]> {
    return this.withLock(() => this.workspace.list());
  }

  async workspaceListByPrefix(prefix: string): Promise<string[]> {
    return this.withLock(() => this.workspace.listByPrefix(prefix));
  }

  async workspaceDelete(key: string): Promise<boolean> {
    return this.withLock(() => this.workspace.delete(key));
  }

  async workspaceToObject(): Promise<Record<string, unknown>> {
    return this.withLock(() => this.workspace.toObject());
  }

  // Compatibility for team-tool
  getContext(): { getTeamSummary: () => { totalTasks: number; completedTasks: number; activeAgents: number } } {
    return {
      getTeamSummary: () => {
        const taskStats = this.taskManager.getTeamStatus();
        const activeAgents = Array.from(this.agentStatuses.values()).filter(s => s.status === 'working').length;
        return {
          totalTasks: taskStats.totalTasks,
          completedTasks: taskStats.completedTasks,
          activeAgents,
        };
      },
    };
  }

  async sendMessage(channel: string, content: string, _to?: string): Promise<void> {
    // In simplified version, we don't support direct messages; just broadcast to channel
    // Use 'parent' as generic sender for team tool messages
    await this.publishMessage(channel, 'parent', content);
  }

  async getMessages(channel: string, limit?: number): Promise<Array<{ from: string; content: string; timestamp: number }>> {
    return this.withLock(() => {
      const msgs = this.messageBus.get(channel) || [];
      return limit ? msgs.slice(-limit) : msgs;
    });
  }

  async publishMessage(channel: string, from: string, content: string): Promise<void> {
    return this.withLock(() => {
      if (!this.messageBus.has(channel)) {
        this.messageBus.set(channel, []);
      }
      this.messageBus.get(channel)!.push({ from, content, timestamp: Date.now() });
      // Notify message sent
      this.notifyUpdate(this.createUpdate(
        `📢 [${channel}] ${from}: ${content.substring(0, 100)}`,
        { channel, from, contentPreview: content.substring(0, 200) }
      ));
    });
  }

  async getTeamStatus(): Promise<{
    agents: Array<{ id: string; currentTaskIndex: number | null; status: string }>;
    tasks: Array<{ index: number; assignee: string | null; status: 'pending' | 'in_progress' | 'completed' | 'failed'; result: string; retryCount: number; retryAvailableAt?: number }>;
    completedTasks: number;
    failedTasks: number;
    pendingTasks: number;
    totalTasks: number;
    isComplete: boolean;
  }> {
    return this.withLock(() => {
      const taskStats = this.taskManager.getTeamStatus();
      const agents = Array.from(this.agentStatuses.entries()).map(([id, status]) => ({ id, ...status }));
      return {
        agents,
        tasks: taskStats.tasks,
        completedTasks: taskStats.completedTasks,
        failedTasks: taskStats.failedTasks,
        pendingTasks: taskStats.pendingTasks,
        totalTasks: taskStats.totalTasks,
        isComplete: taskStats.isComplete,
      };
    });
  }

  async getMyCurrentTask(agentId: string): Promise<number | null> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    return this.withLock(() => {
      return this.agentStatuses.get(role)?.currentTaskIndex ?? null;
    });
  }

  // Compatibility for tests
  insertPendingIndexSorted(idx: number): void {
    this.taskManager.insertPendingIndexSorted(idx);
  }

  // Heartbeat để theo dõi agent còn sống không
  public updateHeartbeat(role: string): void {
    this.agentMonitor.updateHeartbeat(role);
  }
  async claimTask(agentId: string): Promise<number | null> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    return this.withLock(() => {
      const idx = this.taskManager.claimTask(role);
      if (idx !== null) {
        this.agentMonitor.setAgentStatus(role, { currentTaskIndex: idx, status: 'working' });
      }
      return idx;
    });
  }

  // Reclaim tasks from zombie agents (no heartbeat within timeout)
  public reclaimZombieAgents(): void {
    this.agentMonitor.reclaimZombieAgents();
  }

  async releaseTask(agentId: string, taskIndex: number): Promise<boolean> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    return this.withLock(() => {
      const released = this.taskManager.releaseTask(role, taskIndex);
      if (released) {
        this.agentMonitor.setAgentStatus(role, { currentTaskIndex: null, status: 'idle' });
      }
      return released;
    });
  }

  async handleAgentFailure(agentId: string, taskIndex: number, error?: unknown): Promise<void> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    await this.withLock(() => {
      const success = this.taskManager.handleAgentFailure(role, taskIndex, error);
      if (success) {
        this.agentMonitor.setAgentStatus(role, { currentTaskIndex: null, status: 'idle' });
      }
    });
  }

  async reportResult(taskIndex: number, result: string): Promise<void> {
    await this.withLock(() => {
      const task = this.taskManager.getTaskStatus(taskIndex);
      const agentId = task?.assignee;
      this.taskManager.reportResult(taskIndex, result);
      if (agentId) {
        const status = this.agentStatuses.get(agentId);
        if (status) {
          status.currentTaskIndex = null;
          status.status = 'idle';
        }
      }
    });
  }

  async completeTask(agentId: string, taskIndex: number, result: string): Promise<void> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    await this.withLock(() => {
      this.taskManager.completeTask(role, taskIndex, result);
      this.agentMonitor.setAgentStatus(role, { currentTaskIndex: null, status: 'idle' });
    });
  }

  async getResults(): Promise<string[]> {
    return this.withLock(() => this.taskManager.getResults());
  }

  async waitForCompletion(): Promise<void> {
    while (true) {
      const summary = await this.getTeamStatus();
      if (summary.completedTasks === summary.totalTasks && summary.totalTasks > 0) {
        return;
      }
       
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  registerRuntime(runtime: AgentSessionRuntime, role: string): void {
    this.runtimes.push(runtime);
    this.roles.push(role);
    this.agentMonitor.registerAgent(runtime.session.sessionId, role);
    this.size = this.roles.length;
  }

  /**
   * Setup child runtimes (agents) from parent runtime.
   * Creates isolated sessions and starts agent loops.
   */
  async setupChildRuntimes(
    parentRuntime: AgentSessionRuntime,
    baseCwd?: string | ((role: string) => string),
    options?: { createRuntime?: (factory: CreateAgentSessionRuntimeFactory, opts: unknown) => Promise<AgentSessionRuntime> }
  ): Promise<void> {
    if (this.disposed) throw new Error('Team disposed');
    // roles should already be defined via initialize options or registerRuntime
    if (this.roles.length === 0) {
      throw new Error('No agent roles defined. Call initialize() with teamSize or registerRuntime() first.');
    }

    for (const role of this.roles) {
      // Skip parent role (not a child agent)
      if (role === "parent") continue;
      // Determine agent cwd
      let agentCwd: string;
      if (typeof baseCwd === 'function') {
        agentCwd = baseCwd(role);
      } else {
        agentCwd = baseCwd ?? parentRuntime.cwd;
      }
      if (!agentCwd) throw new Error('agentCwd is undefined for role ' + role);

      // Create isolated session directory
      const teamDir = path.join(parentRuntime.services.agentDir, 'teams', this.id);
      const agentSessionDir = path.join(teamDir, role);
      // Use shared session manager (parent's) for all agents
      const sessionManager = parentRuntime.session.sessionManager;

      // Create session start event
      const sessionStartEvent: SessionStartEvent = {
        type: 'session_start',
        reason: 'new'
      };

      // Create child runtime using parent's services and new sessionManager
      // We'll use a factory similar to bootPiclawTeam but without reusing parent's sessionManager
      const factory: CreateAgentSessionRuntimeFactory = async ({
        cwd: sessionCwd,
        agentDir: sessionAgentDir,
        sessionManager: providedSessionManager,
        sessionStartEvent: startEvent,
      }) => {
        // Use parent's shared services (auth, settings, model) but isolated session
        const services = await createAgentSessionServices({
          cwd: sessionCwd,
          agentDir: sessionAgentDir,
          authStorage: parentRuntime.services.authStorage,
          settingsManager: parentRuntime.services.settingsManager,
          modelRegistry: parentRuntime.services.modelRegistry,
        });

        const sessionResult = await createAgentSessionFromServices({
          services,
          sessionManager: providedSessionManager,
          sessionStartEvent: startEvent,
          tools: [], // no tools initially; team_ops will be added separately?
          customTools: [createTeamOpsTool(this)],
        });

        return {
          session: sessionResult.session,
          services,
          diagnostics: services.diagnostics,
        } as CreateAgentSessionRuntimeResult;
      };

      const createRuntimeImpl = options?.createRuntime ?? createAgentSessionRuntime;
      const runtime = await createRuntimeImpl(factory, {
        cwd: agentCwd,
        agentDir: agentSessionDir,
        sessionManager,
        sessionStartEvent,
      });

      // Register
      this.runtimes.push(runtime);
      // roles already exists; we push agent status
      this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
      this.roleByAgentId.set(runtime.session.sessionId, role);
      this.size = this.roles.length;

      // Subscribe to child session events
      runtime.session.subscribe((event: unknown) => this.handleAgentEvent(role, event));
    }
  }

  /**
   * Start agent loops for all registered runtimes.
   * Should be called after initialize().
   */
  startAgentLoops(): void {
    for (const role of this.roles) {
      const runtime = this.runtimes.find(rt => this.roleByAgentId.get(rt.session.sessionId) === role);
      if (runtime) {
        const controller = new AbortController();
        this.childControllers.set(role, controller);
        const p = (this.runAgentLoop(role, runtime, controller)).catch(err => {
          console.error(`Agent ${role} loop crashed:`, err);
        });
        this.childPromises.push(p);
      }
    }
  }

  private async runAgentLoop(role: string, runtime: AgentSessionRuntime, controller: AbortController): Promise<void> {
    let turnCount = 0;
    const MAX_TURNS = 50;

    this.notifyUpdate(this.createUpdate(
      `🤖 Agent ${role} started working`,
      { role, status: 'started' }
    ));

    while (!controller.signal.aborted) {
      this.updateHeartbeat(role);
      const status = await this.getTeamStatus();

      if (turnCount > 0) {
        this.notifyUpdate(this.createUpdate(
          `🔄 Agent ${role} turn ${turnCount}: ${status.completedTasks}/${status.totalTasks} tasks done`,
          { role, turn: turnCount, completedTasks: status.completedTasks, totalTasks: status.totalTasks }
        ));
      }

      if (status.completedTasks === status.totalTasks && status.totalTasks > 0) {
        this.notifyUpdate(this.createUpdate(
          `✅ Agent ${role}: all tasks completed!`,
          { role, status: 'finished' }
        ));
        break;
      }

      if (turnCount >= MAX_TURNS) {
        this.notifyUpdate(this.createUpdate(
          `⚠️ Agent ${role}: max turns (${MAX_TURNS}) reached`,
          { role, status: 'max_turns' }
        ));
        break;
      }

      try {
        const prompt = turnCount === 0
          ? this.getBootstrapPrompt(role)
          : await this.getContinuationPrompt(turnCount);

        await runtime.session.prompt(prompt);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Agent ${role} prompt error:`, error);
        this.notifyUpdate(this.createUpdate(
          `❌ Agent ${role} error: ${errorMessage}`,
          { role, error: errorMessage },
          true
        ));
      }

      turnCount++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Handle events from child sessions and forward to UI updates.
   */
  private handleAgentEvent(role: string, event: unknown): void {
    // Guard: ensure event is an object with a type property
    if (typeof event !== 'object' || event === null || !('type' in event)) return;
    const e = event as { type: string; stopReason?: unknown; message?: unknown; toolName?: unknown };
    let text: string | null = null;
    switch (e.type) {
      case 'agent_start':
        text = `[${role}] Agent started`;
        break;
      case 'agent_end':
        text = `[${role}] Agent finished: ${String(e.stopReason)}`;
        break;
      case 'message_start':
        if (e.message && typeof e.message === 'object' && 'role' in e.message) {
          const msg = e.message as { role: string; content?: unknown };
          if (msg.role === 'user') {
            const content = this.extractText(msg);
            text = `[${role}] User: ${content.substring(0, 200)}`;
          } else if (msg.role === 'assistant') {
            const content = this.extractText(msg);
            text = `[${role}] Assistant: ${content.substring(0, 200)}`;
          }
        }
        break;
      case 'tool_execution_start':
        if (typeof e.toolName === 'string') {
          text = `[${role}] Tool: ${e.toolName}`;
        }
        break;
      case 'tool_execution_end':
        if (typeof e.toolName === 'string') {
          text = `[${role}] Tool ${e.toolName} done`;
        }
        break;
      case 'message_update':
        // ignore streaming updates
        break;
    }
    if (text) {
      this.notifyUpdate({
        content: [{ type: 'text', text }],
        details: { role, eventType: e.type },
        isError: e.type === 'agent_end' && e.stopReason === 'error'
      });
    }
  }

  /**
   * Extract plain text from a message object (handles array content).
   */
  private extractText(message: unknown): string {
    if (!message || typeof message !== 'object') return '';
    const msg = message as { content?: unknown };
    if (typeof msg.content === 'string') return msg.content;
    const parts = (msg.content || []) as Array<{ type: string; text?: string }>;
    const texts = parts.filter(c => c.type === 'text').map(c => c.text).filter(Boolean);
    return texts.join('');
  }

  // resetTaskState removed – TaskManager.initialize() replaces it

  private sendInitializationUpdate(tasks: string[]): void {
    this.notifyUpdate(this.createUpdate(
      `📋 Team initialized with ${tasks.length} tasks`,
      { totalTasks: tasks.length, agents: this.roles }
    ));
  }

  async initialize(tasks: string[]): Promise<void> {
    await this.withLock(async () => {
      this.taskManager.initialize(tasks);
      this.messageBus.clear();
      await this.workspaceClear();
      this.agentMonitor.resetAll();
    });
    this.sendInitializationUpdate(tasks);
  }


  private getBootstrapPrompt(role: string): string {
    const bootstrapTasksList = this.taskManager.getTasks().map((t, i) => `[${i}] ${t}`).join("\n");
    return `You are ${role}, an AI agent in a collaborative team.

Team tasks:
${bootstrapTasksList}

Your role: ${role}

INSTRUCTIONS:
1. Use team_ops(action="claim_task") to get a task
2. Work on the task using regular tools (bash, read, write, edit, git, etc.)
3. When done, call team_ops(action="complete_task", taskIndex=X, result="summary")
4. If you need to share data, use team_ops(action="workspace_write", key="...", value="...")
5. Communicate via team_ops(action="send_message", channel="team.chat", content="...")
6. Continue claiming tasks until all are done

Start by claiming your first task.`;
  }

  private async getContinuationPrompt(turnCount: number): Promise<string> {
    const status = await this.getTeamStatus();
    const messages = await this.getMessages("team.chat", 5);
    const recentMessages = messages.map(m => `[${m.from}]: ${m.content}`).join("\n");

    return `Turn ${turnCount + 1}. Continue.

Progress: ${status.completedTasks}/${status.totalTasks} tasks completed.
${recentMessages ? `\nRecent messages:\n${recentMessages}\n` : ""}

Use team_ops to continue. If all tasks done, finish up.`;
  }

  // Extend dispose to wait for child loops and dispose child runtimes
}

// ============================================
// TEAM REGISTRY
// ============================================

/**
 * Global registry for managing active teams.
 * Allows querying team status and waiting for completion from outside the team execution.
 */
export class TeamRegistry {
  private static instance: TeamRegistry | null = null;
  private teams: Map<string, AgentTeam> = new Map();
  private locked = false;
  private autoDisposeTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly AUTO_DISPOSE_DELAY = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): TeamRegistry {
    if (!TeamRegistry.instance) {
      TeamRegistry.instance = new TeamRegistry();
    }
    return TeamRegistry.instance;
  }

  register(teamId: string, team: AgentTeam): void {
    this.teams.set(teamId, team);
    console.log(`[TeamRegistry] Registered team ${teamId}`);
  }

  unregister(teamId: string): void {
    this.clearAutoDisposeTimer(teamId);
    this.teams.delete(teamId);
    console.log(`[TeamRegistry] Unregistered team ${teamId}`);
  }

  get(teamId: string): AgentTeam | undefined {
    return this.teams.get(teamId);
  }

  has(teamId: string): boolean {
    return this.teams.has(teamId);
  }

  getAll(): Map<string, AgentTeam> {
    return new Map(this.teams);
  }

  // Reset auto-dispose timer for a team (called on query)
  resetAutoDisposeTimer(teamId: string): void {
    this.clearAutoDisposeTimer(teamId);
    const team = this.teams.get(teamId);
    if (team) {
      const timer = setTimeout(() => {
        this.autoDisposeTeam(teamId);
      }, this.AUTO_DISPOSE_DELAY).unref?.();
      if (timer) {
        this.autoDisposeTimers.set(teamId, timer);
      }
    }
  }

  private clearAutoDisposeTimer(teamId: string): void {
    const timer = this.autoDisposeTimers.get(teamId);
    if (timer) {
      clearTimeout(timer);
      this.autoDisposeTimers.delete(teamId);
    }
  }

  private async autoDisposeTeam(teamId: string): Promise<void> {
    const team = this.teams.get(teamId);
    if (team) {
      try {
        await team.dispose();
        this.unregister(teamId);
        console.log(`[TeamRegistry] Auto-disposed team ${teamId} after inactivity`);
      } catch (e) {
        console.error(`[TeamRegistry] Failed to auto-dispose team ${teamId}:`, e);
      }
    }
  }

  async waitForTeam(teamId: string, timeoutMs?: number): Promise<boolean> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found in registry`);
    }

    const startTime = Date.now();
    while (true) {
      const status = await team.getTeamStatus();
      if (status.completedTasks === status.totalTasks && status.totalTasks > 0) {
        return true;
      }
      if (timeoutMs && Date.now() - startTime > timeoutMs) {
        return false;
      }
       
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  async getTeamStatus(teamId: string): Promise<{
    agents: Array<{ id: string; currentTaskIndex: number | null; status: string }>;
    tasks: Array<{ index: number; assignee: string | null; status: string; result: string }>;
    completedTasks: number;
    totalTasks: number;
  } | null> {
    const team = this.teams.get(teamId);
    if (!team) return null;
    // Reset auto-dispose timer on any query
    this.resetAutoDisposeTimer(teamId);
    return await team.getTeamStatus();
  }
}

function createTeamBase(team: AgentTeam, roles: string[]): void {
  for (const role of roles) {
    team.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
  }
  team.roles = roles;
  team.size = roles.length;
}

function generateTeamId(): string {
  return `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function bootPiclawTeam(
  parentRuntime: AgentSessionRuntime,
  options: {
    teamSize?: number;
    teamRoles?: string[];
    tools?: string[];
    agentCwd?: string | ((role: string) => string);
  } = {}
): Promise<AgentTeam> {
  const { roles: normalizedRoles } = validateOptions(
    options.teamSize ?? 2,
    Array.isArray(options.teamRoles) ? options.teamRoles : []
  );
  const allRoles = ["parent", ...normalizedRoles];

  const team = new AgentTeam();
  team.setTeamId(generateTeamId());
  createTeamBase(team, allRoles);

  await team.setupChildRuntimes(parentRuntime, options.agentCwd);
  TeamRegistry.getInstance().register(team.id, team);

  return team;
}

export function startCompletionMonitor(team: AgentTeam): void {
  team.monitorInterval = setInterval(() => {
    team.withLock(() => team.reclaimZombieAgents()).catch((e) => console.error('Reclaim error:', e));
    team.getTeamStatus().then(status => {
      if (status.isComplete && status.totalTasks > 0) {
        clearInterval(team.monitorInterval!);
        team.monitorInterval = null;
        try {
          TeamRegistry.getInstance().resetAutoDisposeTimer(team.id);
        } catch (e) {
          console.warn('Failed to schedule auto-dispose:', e);
        }
      }
    }).catch((e) => console.error('Status error:', e));
  }, 1000);
}

function sendImmediateStartUpdate(team: AgentTeam, onUpdate?: (update: AgentToolResult<unknown>) => void, tasks?: string[]): void {
  onUpdate?.(team.createUpdate(
    `✅ Team started (teamId: ${team.id}). Progress updates will follow.`,
    { teamId: team.id, agentCount: team.roles.length, totalTasks: tasks?.length ?? 0 }
  ));
}

async function sendCompletionUpdate(team: AgentTeam, onUpdate?: (update: AgentToolResult<unknown>) => void): Promise<void> {
  const finalStatus = await team.getTeamStatus();
  onUpdate?.(team.createUpdate(
    `🎉 Team execution complete: ${finalStatus.completedTasks}/${finalStatus.totalTasks} tasks done`,
    { completed: finalStatus.completedTasks, total: finalStatus.totalTasks }
  ));
}

export async function executeTeamTasks(
  team: AgentTeam,
  tasks: string[],
  onUpdate?: (update: AgentToolResult<unknown>) => void,
  _options?: { wait?: boolean; maxTurnsPerAgent?: number }
): Promise<AgentTeam> {
  team.setOnUpdate(onUpdate);
  await team.initialize(tasks);
  team.startAgentLoops();
  startCompletionMonitor(team);

  if (_options?.wait) {
    try {
      await Promise.all(team.childPromises);
    } finally {
      if (team.monitorInterval) {
        clearInterval(team.monitorInterval);
        team.monitorInterval = null;
      }
    }
    await sendCompletionUpdate(team, onUpdate);
  } else {
    sendImmediateStartUpdate(team, onUpdate, tasks);
  }
  return team;
}
