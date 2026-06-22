#!/usr/bin/env node

/**
 * Team Ops Renderer
 *
 * Beautiful UI for team_ops tool results.
 * Shows team status, tasks, workspace, messages.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

interface TeamStatusDetails {
  teamId: string;
  totalAgents: number;
  activeAgents: number;
  pendingTasks: number;
  completedTasks: number;
  agents?: Array<{ id: string; status: string; currentTask?: string }>;
}

interface TeamMessage {
  from: string;
  channel: string;
  content: string;
  timestamp: string;
}

// interface WorkspaceEntry unused - removed

/**
 * Register the team_ops renderer.
 */
function renderGetTeamStatus(details: any, _theme: any): string[] {
  const status = details as TeamStatusDetails;
  const lines: string[] = [];
  lines.push(`\nTeam: ${status.teamId}`);
  lines.push(`Agents: ${status.activeAgents}/${status.totalAgents} active`);
  lines.push(`Tasks: ${status.pendingTasks} pending, ${status.completedTasks} completed`);

  if (status.agents && status.agents.length > 0) {
    lines.push("\nAgents:");
    for (const agent of status.agents) {
      const statusIcon = agent.status === "working" ? "🔄" : "💤";
      lines.push(`  ${statusIcon} ${agent.id}: ${agent.status}${agent.currentTask ? ` - ${agent.currentTask.substring(0, 40)}...` : ''}`);
    }
  }
  return lines;
}

function renderGetMessages(details: any, theme: any): string[] {
  const messages = details.messages as TeamMessage[] || [];
  const lines: string[] = [];
  lines.push(`\nMessages (${messages.length}):`);
  for (const msg of messages.slice(0, 10)) {
    lines.push(`  [${msg.channel}] ${theme.fg("accent", msg.from)}: ${msg.content.substring(0, 60)}${msg.content.length > 60 ? '...' : ''}`);
  }
  if (messages.length > 10) {
    lines.push(`  ${theme.fg("dim", `...and ${messages.length - 10} more.`)}`);
  }
  return lines;
}

function renderWorkspaceRead(details: any, theme: any): string[] {
  const lines: string[] = [];
  lines.push(`\nWorkspace key: ${theme.fg("accent", details.key)}`);
  if (details.value !== undefined) {
    lines.push(`Value: ${theme.fg("text", details.value.substring(0, 200))}${details.value.length > 200 ? '...' : ''}`);
  } else {
    lines.push(theme.fg("dim", "No value set"));
  }
  return lines;
}

function renderWorkspaceWrite(details: any, theme: any): string[] {
  return [`\n${theme.fg("success", "✓ Wrote to workspace")}: ${details.key}`];
}

function renderSendMessage(details: any, theme: any): string[] {
  return [`\n${theme.fg("success", "✓ Message sent")} to ${details.channel || 'team.chat'}`];
}

function renderClaimTask(details: any, theme: any): string[] {
  if (details.taskIndex !== undefined) {
    return [`\n${theme.fg("success", "✓ Claimed task")} #${details.taskIndex}`];
  }
  return [`\n${theme.fg("warning", "No tasks available")}`];
}

function renderCompleteTask(details: any, theme: any): string[] {
  return [`\n${theme.fg("success", "✓ Completed task")} #${details.taskIndex}`];
}

function renderReleaseTask(details: any, theme: any): string[] {
  return [`\n${theme.fg("accent", "↩ Released task")} #${details.taskIndex}`];
}

function renderUpdateStatus(details: any, theme: any): string[] {
  return [`\n${theme.fg("accent", "● Status updated")}: ${details.status}`];
}

export function registerTeamOpsRenderer(api: ExtensionAPI): void {
  if (typeof api.registerMessageRenderer !== 'function') {
    return;
  }

  api.registerMessageRenderer("team_ops_result", (msg: any, options, theme) => {
    // @ts-ignore
    const details = msg.details;
    if (!details) {
      return new Text("👥 Team operation");
    }

    const lines: string[] = [];

    // Header
    lines.push(theme.fg("accent", "👥 Team Ops").bold());

    // Action from content
    const contentText = msg.content?.[0]?.text || "";
    if (contentText && !contentText.includes("❌")) {
      lines.push(`\n${theme.fg("text", contentText)}`);
    }

    // Error handling
    if (details.error || msg.isError) {
      lines.push(`\n${theme.fg("error", `❌ ${details.error || "Error occurred"}`)}`);
      return new Text(lines.join("\n"));
    }

    const renderers: Record<string, (d: any, t: any) => string[]> = {
      get_team_status: renderGetTeamStatus,
      get_messages: renderGetMessages,
      workspace_read: renderWorkspaceRead,
      workspace_write: renderWorkspaceWrite,
      send_message: renderSendMessage,
      claim_task: renderClaimTask,
      complete_task: renderCompleteTask,
      release_task: renderReleaseTask,
      update_status: renderUpdateStatus,
    };
    const renderer = renderers[details.action];
    if (renderer) {
      lines.push(...renderer(details, theme));
    } else {
      lines.push(`\n${theme.fg("warning", `Unknown action: ${details.action}`)}`);
    }

    return new Text(lines.join("\n"));
  });
}
