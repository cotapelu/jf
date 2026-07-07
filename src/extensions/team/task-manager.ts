/**
 * Task Manager
 *
 * Handles task lifecycle: distribution, status tracking, retries, and backoff.
 * Extracted from AgentTeam for single responsibility.
 */

import type { AgentToolResult } from "@earendil-works/pi-coding-agent";

export interface TaskStatus {
  assignee: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result: string;
  retryCount: number;
  retryAvailableAt?: number; // timestamp when task becomes claimable again after backoff
}

export interface TeamTaskStatus {
  index: number;
  assignee: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result: string;
  retryCount: number;
  retryAvailableAt?: number;
}

export interface TeamStatus {
  agents: Array<{ id: string; currentTaskIndex: number | null; status: string }>;
  tasks: TeamTaskStatus[];
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  totalTasks: number;
  isComplete: boolean; // true when all tasks are either completed or failed
}

export interface TaskManagerOptions {
  maxRetries?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60000;

function calculateRetryDelay(retryCount: number, base: number, max: number): number {
  const delay = base * Math.pow(2, retryCount - 1);
  return Math.min(delay, max);
}

/**
 * TaskManager: pure task distribution and status tracking.
 * - No agent status tracking (except assignee)
 * - No workspace/message bus
 * - No agent heartbeat
 */
export class TaskManager {
  private tasks: string[] = [];
  taskStatuses: Map<number, TaskStatus> = new Map(); // public for test access
  pendingIndices: number[] = []; // public for test access (sorted list)
  private maxRetries: number;
  private baseRetryDelayMs: number;
  private maxRetryDelayMs: number;

  // Optional notification callback (for updates)
  private onUpdate?: (update: AgentToolResult<unknown>) => void;

  constructor(options: TaskManagerOptions = {}) {
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? BASE_RETRY_DELAY_MS;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? MAX_RETRY_DELAY_MS;
  }

  setOnUpdate(fn: ((update: AgentToolResult<unknown>) => void) | undefined): void {
    this.onUpdate = fn;
  }

  // Initialize with a list of tasks
  initialize(tasks: string[]): void {
    this.tasks = tasks;
    this.taskStatuses.clear();
    this.pendingIndices = [];
    for (let i = 0; i < tasks.length; i++) {
      this.taskStatuses.set(i, { assignee: null, status: 'pending', result: '', retryCount: 0 });
      this.pendingIndices.push(i);
    }
  }

  // Get all tasks
  getTasks(): string[] {
    return this.tasks;
  }

  // Get status for a specific task
  getTaskStatus(index: number): TaskStatus | undefined {
    return this.taskStatuses.get(index);
  }

  // Get all task statuses (for external queries like reclaimZombieAgents)
  getAllTaskStatuses(): Map<number, TaskStatus> {
    return this.taskStatuses;
  }

  // Claim a pending task for an agent (role)
  // Returns task index or null if none available
  claimTask(role: string): number | null {
    for (let i = 0; i < this.pendingIndices.length; i++) {
      const idx = this.pendingIndices[i];
      const task = this.taskStatuses.get(idx);
      if (!task || task.status !== 'pending') continue;
      // Check backoff
      if (task.retryAvailableAt && task.retryAvailableAt > Date.now()) {
        continue; // not yet claimable
      }
      // Claim this task
      task.retryAvailableAt = undefined;
      task.assignee = role;
      task.status = 'in_progress';
      // Efficient removal
      if (i === 0) {
        this.pendingIndices.shift();
      } else {
        this.pendingIndices.splice(i, 1);
      }
      this.notifyUpdate(
        `🔨 Agent ${role} claimed task ${idx}`,
        { agent: role, taskIndex: idx, taskPreview: this.tasks[idx].substring(0, 200), retryCount: task.retryCount }
      );
      return idx;
    }
    return null;
  }

  // Release a task (agent gives up without completing)
  // Returns true if successfully released
  releaseTask(role: string, taskIndex: number): boolean {
    const task = this.taskStatuses.get(taskIndex);
    if (!task || task.assignee !== role || task.status === 'completed' || task.status === 'failed') {
      return false;
    }
    task.assignee = null;
    task.status = 'pending';
    task.retryAvailableAt = undefined;
    this.insertPendingIndexSorted(taskIndex);
    this.notifyUpdate(
      `↩️ Agent ${role} released task ${taskIndex}`,
      { agent: role, taskIndex: taskIndex, retryCount: task.retryCount }
    );
    return true;
  }

  // Complete a task successfully
  completeTask(role: string, taskIndex: number, result: string): boolean {
    const task = this.taskStatuses.get(taskIndex);
    if (!task || task.assignee !== role) return false;
    task.status = 'completed';
    task.result = result;
    task.assignee = null;
    this.removePendingIndex(taskIndex);
    this.notifyUpdate(
      `✅ Agent ${role} completed task ${taskIndex}`,
      { agent: role, taskIndex, resultPreview: result.substring(0, 150) }
    );
    return true;
  }

  // Report result without role check (for external completion)
  reportResult(taskIndex: number, result: string): void {
    const task = this.taskStatuses.get(taskIndex);
    if (!task) return;
    task.status = 'completed';
    task.result = result;
    task.assignee = null;
    this.removePendingIndex(taskIndex);
  }

  // Handle agent failure on a task (increment retry or mark failed)
  handleAgentFailure(role: string, taskIndex: number, error?: unknown): boolean {
    const task = this.taskStatuses.get(taskIndex);
    if (!task || task.assignee !== role) return false;

    task.assignee = null;
    task.retryCount++;

    if (task.retryCount >= this.maxRetries) {
      this.handleRetryExceeded(task, role, taskIndex, error);
    } else {
      this.scheduleRetry(task, role, taskIndex);
    }

    return true;
  }

  private handleRetryExceeded(task: TaskStatus, role: string, taskIndex: number, error?: unknown): void {
    task.status = 'failed';
    task.result = error instanceof Error ? error.message : (error ? String(error) : 'Unknown error');
    task.retryAvailableAt = undefined;
    this.removePendingIndex(taskIndex);
    this.notifyUpdate(
      `❌ Task ${taskIndex} failed after ${task.retryCount} retries (agent: ${role})`,
      { agent: role, taskIndex, retryCount: task.retryCount, error: task.result },
      true
    );
  }

  private scheduleRetry(task: TaskStatus, role: string, taskIndex: number): void {
    const delay = calculateRetryDelay(task.retryCount, this.baseRetryDelayMs, this.maxRetryDelayMs);
    task.status = 'pending';
    task.retryAvailableAt = Date.now() + delay;
    this.insertPendingIndexSorted(taskIndex);
    this.notifyUpdate(
      `⚠️ Agent ${role} failed task ${taskIndex} (retry ${task.retryCount}/${this.maxRetries}), retry in ${delay}ms`,
      { agent: role, taskIndex, retryCount: task.retryCount, delay }
    );
  }

  // Get overall team status (tasks completion stats)
  getTeamStatus(): Omit<TeamStatus, 'agents'> {
    const tasksArray = Array.from(this.taskStatuses.entries()).map(([idx, status]) => ({ index: idx, ...status }));
    const completed = Array.from(this.taskStatuses.values()).filter(t => t.status === 'completed').length;
    const failed = Array.from(this.taskStatuses.values()).filter(t => t.status === 'failed').length;
    const pending = Array.from(this.taskStatuses.values()).filter(t => t.status === 'pending').length;
    const total = this.tasks.length;
    return {
      tasks: tasksArray,
      completedTasks: completed,
      failedTasks: failed,
      pendingTasks: pending,
      totalTasks: total,
      isComplete: completed + failed === total && total > 0,
    };
  }

  // Get results for all tasks (by index)
  getResults(): string[] {
    const results: string[] = new Array(this.tasks.length).fill('');
    this.taskStatuses.forEach((task, idx) => {
      results[idx] = task.result;
    });
    return results;
  }

  // Helper: binary search insert to keep pendingIndices sorted
  insertPendingIndexSorted(idx: number): void {
    let low = 0;
    let high = this.pendingIndices.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.pendingIndices[mid] < idx) low = mid + 1;
      else high = mid;
    }
    // Avoid duplicates
    if (low > 0 && this.pendingIndices[low - 1] === idx) return;
    if (low < this.pendingIndices.length && this.pendingIndices[low] === idx) return;
    this.pendingIndices.splice(low, 0, idx);
  }

  reclaimZombieTasks(role: string, now: number = Date.now()): void {
    const all = this.getAllTaskStatuses();
    for (const [idx, task] of all) {
      if (task.assignee === role && task.status === 'in_progress') {
        task.assignee = null;
        task.retryCount++;
        if (task.retryCount >= this.maxRetries) {
          task.status = 'failed';
          task.result = 'Agent zombie timeout';
          this.removePendingIndex(idx);
          this.notifyUpdate(
            `🧟 Zombie agent ${role} detected on task ${idx}, task failed`,
            { agent: role, taskIndex: idx, status: 'failed', retryCount: task.retryCount },
            true
          );
        } else {
          task.status = 'pending';
          const delay = calculateRetryDelay(task.retryCount, this.baseRetryDelayMs, this.maxRetryDelayMs);
          task.retryAvailableAt = now + delay;
          this.insertPendingIndexSorted(idx);
          this.notifyUpdate(
            `🧟 Zombie agent ${role} detected on task ${idx}, reclaiming (retry ${task.retryCount}/${this.maxRetries})`,
            { agent: role, taskIndex: idx, status: 'pending', retryCount: task.retryCount, delay },
            false
          );
        }
      }
    }
  }

  private removePendingIndex(idx: number): void {
    const pos = this.pendingIndices.indexOf(idx);
    if (pos !== -1) {
      this.pendingIndices.splice(pos, 1);
    }
  }

  private notifyUpdate(content: string, details?: unknown, isError?: boolean): void {
    if (this.onUpdate) {
      try {
        this.onUpdate({
          content: [{ type: "text", text: content }],
          details,
          isError: isError || false
        });
      } catch (e) {
        console.warn('TaskManager update failed:', e);
      }
    }
  }
}
