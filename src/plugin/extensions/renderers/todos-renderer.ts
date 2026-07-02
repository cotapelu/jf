#!/usr/bin/env node
/**
 * Todos Renderer
 *
 * Beautiful UI for todo tool results.
 * Shows phases, tasks with status icons, progress bar.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { styleError, styleSuccess, styleWarning, styleText } from "../utils/render-utils.js";

interface TodoPhase {
  name: string;
  tasks: Array<{
    id: string;
    content: string;
    status: "pending" | "in_progress" | "completed" | "abandoned";
  }>;
}

interface TodoDetails {
  action: "list" | "add_phase" | "add_task" | "update" | "remove_task" | "delete";
  phases?: TodoPhase[];
  totalTasks?: number;
  completedTasks?: number;
  message?: string;
}

/**
 * Register the todos renderer.
 */
export function registerTodosRenderer(api: ExtensionAPI): void {
  // Only register if the API supports it (for backwards compatibility with tests/mocks)
  if (typeof api.registerMessageRenderer !== 'function') {
    return;
  }

  api.registerMessageRenderer("todos_result", (msg: any, options, theme) => {
    const details = msg.details as TodoDetails | undefined;
    if (!details) {
      return new Text("📋 Todo operation completed");
    }

    const lines: string[] = [];

    // Header
    lines.push(theme.fg("accent", "📋 TODO List").bold());

    // Global stats if available
    if (details.totalTasks !== undefined && details.completedTasks !== undefined) {
      const percent = details.totalTasks > 0 ? Math.round((details.completedTasks / details.totalTasks) * 100) : 0;
      lines.push(`\nProgress: ${details.completedTasks}/${details.totalTasks} (${percent}%)`);

      // Simple progress bar
      const barLength = 20;
      const filled = Math.round(barLength * percent / 100);
      const bar = "█".repeat(filled) + "░".repeat(barLength - filled);
      lines.push(theme.fg(percent === 100 ? "success" : "accent", bar));
    }

    // Message (from action result)
    if (details.message) {
      lines.push(`\n${theme.fg("text", details.message)}`);
    }

    // Phases and tasks
    if (details.phases && details.phases.length > 0) {
      lines.push(""); // spacer
      for (const phase of details.phases) {
        lines.push(theme.fg("accent", `\n${phase.name}`).bold());
        for (const task of phase.tasks) {
          const icon = getStatusIcon(task.status);
          const statusColor = getStatusColor(task.status, theme);
          const taskLine = `  ${icon} ${task.content}`;
          lines.push(statusColor(taskLine));

          // Show task ID in dim (for reference)
          lines.push(theme.fg("dim", `    ID: ${task.id}`));
        }
      }
    }

    return new Text(lines.join("\n"));
  });
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "completed": return "✅";
    case "in_progress": return "🔄";
    case "abandoned": return "❌";
    default: return "⏳";
  }
}

function getStatusColor(status: string, theme: any): (text: string) => string {
  switch (status) {
    case "completed": return (text: string) => theme.fg("success", text);
    case "in_progress": return (text: string) => theme.fg("warning", text);
    case "abandoned": return (text: string) => theme.fg("error", text);
    default: return (text: string) => theme.fg("text", text);
  }
}
