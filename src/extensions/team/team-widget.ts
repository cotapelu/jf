#!/usr/bin/env node
/**
 * Team Status Widget
 *
 * Shows live team overview in the UI widget area.
 * Displays: active teams, task progress, agent statuses.
 * Supports toggle via /team command.
 */

import type { ExtensionAPI, ExtensionContext, ExtensionUIContext, Theme } from "@earendil-works/pi-coding-agent";
import { TeamRegistry } from "./team-manager.js";
import type { AgentTeam } from "./team-manager.js"; // Added for type

// Unique symbol for per-session state attachment
const TEAM_WIDGET_STATE = Symbol('teamWidgetState');

interface TeamWidgetSessionState {
  enabled: boolean;
  ctx: ExtensionContext | null;
  intervalId: NodeJS.Timeout | null;
}

// Using ExtensionContext directly; state stored via symbol

interface AgentStatus {
  id: string;
  currentTaskIndex: number | null;
  status: string;
}

interface TeamStatus {
  agents: AgentStatus[];
  tasks: Array<{ index: number; assignee: string | null; status: 'pending' | 'in_progress' | 'completed' | 'failed'; result: string; retryCount: number; retryAvailableAt?: number }>;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  totalTasks: number;
  isComplete: boolean;
}

function getState(ctx: ExtensionContext): TeamWidgetSessionState | undefined {
  // @ts-ignore - accessing symbol property
  return ctx[TEAM_WIDGET_STATE];
}

function ensureState(ctx: ExtensionContext): TeamWidgetSessionState {
  let state = getState(ctx);
  if (!state) {
    state = { enabled: true, ctx: ctx, intervalId: null };
    // @ts-ignore - symbol-keyed property
    ctx[TEAM_WIDGET_STATE] = state;
  }
  return state;
}

function buildHeaderLines(theme: Theme): string[] {
  return [
    theme.fg("accent", "👥 Team").bold(),
    ""
  ];
}

function buildTeamLines(ui: ExtensionUIContext, teamId: string, status: TeamStatus): string[] {
  const shortId = teamId.slice(-6);
  const lines: string[] = [];
  lines.push(ui.theme.fg("accent", `Team ${shortId}`));
  lines.push(`  Tasks: ${status.completedTasks}/${status.totalTasks} (pending: ${status.pendingTasks}, failed: ${status.failedTasks})`);
  const agentCount = status.agents.length;
  const idleAgents = status.agents.filter((a: AgentStatus) => a.status === 'idle').length;
  const workingAgents = status.agents.filter((a: AgentStatus) => a.status === 'working' || a.status === 'in_progress').length;
  lines.push(`  Agents: ${agentCount} (idle: ${idleAgents}, working: ${workingAgents})`);
  lines.push(""); // spacer
  return lines;
}

function processTeams(ui: ExtensionUIContext, teams: Map<string, AgentTeam>, lines: string[]): Promise<void> {
  return new Promise((resolve) => {
    let pending = teams.size;
    if (pending === 0) { resolve(); return; }
    teams.forEach((team, teamId) => {
      team.getTeamStatus().then(
        (status) => {
          lines.push(...buildTeamLines(ui, teamId, status));
          if (--pending === 0) resolve();
        },
        () => {
          lines.push(ui.theme.fg("error", `Team ${teamId.slice(-6)}: error fetching status`));
          if (--pending === 0) resolve();
        }
      );
    });
  });
}

function refreshWidget(ui: ExtensionUIContext): Promise<void> {
  return new Promise((resolve) => {
    try {
      const registry = TeamRegistry.getInstance();
      const teams = registry.getAll();
      const lines: string[] = [];
      lines.push(...buildHeaderLines(ui.theme));
      if (teams.size === 0) {
        lines.push(ui.theme.fg("muted", "No active teams"));
        ui.setWidget("team", lines);
        resolve();
        return;
      }
      processTeams(ui, teams, lines).then(() => { ui.setWidget("team", lines); resolve(); });
    } catch { resolve(); }
  });
}

function startWidget(ctx: ExtensionContext) {
  const state = ensureState(ctx);
  // Prevent double start
  if (state.intervalId) return;
  state.ctx = ctx;
  const ui = ctx.ui;
  // Initial refresh
  refreshWidget(ui).catch(() => {});
  // Periodic refresh every 2 seconds
  state.intervalId = setInterval(() => {
    if (state.enabled && state.ctx) {
      refreshWidget(state.ctx.ui).catch(() => {});
    }
  }, 2000);
}

function stopWidget(state: TeamWidgetSessionState) {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  if (state.ctx) {
    try {
      state.ctx.ui.setWidget("team", undefined);
    } catch {
      // ignore if UI gone
    }
    state.ctx = null; // break reference
  }
}

/**
 * Toggle team widget visibility.
 * @returns new enabled state (true = visible)
 */
export function toggleTeamWidget(ctx: ExtensionContext): boolean {
  const state = ensureState(ctx);
  state.enabled = !state.enabled;
  if (state.enabled) {
    startWidget(ctx);
  } else {
    stopWidget(state);
  }
  return state.enabled;
}

/**
 * Get current team widget enabled state for a given session context.
 */
export function getTeamWidgetEnabled(ctx: ExtensionContext): boolean {
  const state = getState(ctx);
  return state?.enabled ?? true;
}

export function registerTeamWidget(api: ExtensionAPI): void {
  api.on('session_start', async (_event, ctx: ExtensionContext) => {
    const state: TeamWidgetSessionState = { enabled: true, ctx: ctx, intervalId: null };
    // @ts-ignore
    ctx[TEAM_WIDGET_STATE] = state;
    if (state.enabled) startWidget(ctx);
    api.on('session_shutdown', () => {
      stopWidget(state);
      // @ts-ignore
      delete ctx[TEAM_WIDGET_STATE];
    });
  });
}
