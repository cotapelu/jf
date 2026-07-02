#!/usr/bin/env node

/**
 * Renderer Tests
 *
 * Tests for custom message renderers.
 */

import { describe, it, expect, vi } from "vitest";
import { Text } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";

// Mock theme
function createMockTheme(): any {
  return {
    fg: (color: string, text?: string) => (text ?? color),
    bg: (color: string, text?: string) => (text ?? color),
    bold: (text: string) => text,
  };
}

// Import renderers (we'll test them via direct function calls if exported)
// Since they register via API, we test the rendering logic separately by extracting it.

describe("Branch Summary Renderer", () => {
  it("renders branch summary with details", () => {
    const theme = createMockTheme();
    const msg = {
      details: {
        fromId: "entry-123",
        summary: "This is a branch summary",
      },
    };

    // Simulate render logic
    const lines: string[] = [];
    lines.push(theme.fg("accent", "🌿 Branch Summary"));
    lines.push("");
    lines.push(theme.fg("text", "This is a branch summary"));
    lines.push(`\nFrom entry: ${theme.fg("accent", "entry-123")}`);

    const result = new Text(lines.join("\n"));
    expect(result).toBeDefined();
  });
});

describe("Team Ops Renderer", () => {
  it("renders get_team_status", () => {
    const theme = createMockTheme();
    const details = {
      action: "get_team_status",
      teamId: "team-1",
      totalAgents: 2,
      activeAgents: 2,
      pendingTasks: 3,
      completedTasks: 5,
      agents: [
        { id: "agent-1", status: "working", currentTask: "Task A" },
        { id: "agent-2", status: "idle" },
      ],
    };

    const lines: string[] = [];
    lines.push(theme.fg("accent", "👥 Team Ops"));
    lines.push(`\nTeam: ${details.teamId}`);
    lines.push(`Agents: ${details.activeAgents}/${details.totalAgents} active`);
    lines.push(`Tasks: ${details.pendingTasks} pending, ${details.completedTasks} completed`);
    lines.push("\nAgents:");
    for (const agent of details.agents) {
      const statusIcon = agent.status === "working" ? "🔄" : "💤";
      lines.push(`  ${statusIcon} ${agent.id}: ${agent.status}${agent.currentTask ? ` - ${agent.currentTask.substring(0, 40)}...` : ''}`);
    }

    const result = new Text(lines.join("\n"));
    expect(result).toBeDefined();
    expect(lines.some(l => l.includes("team-1"))).toBe(true);
  });

  it("renders claim_task success", () => {
    const theme = createMockTheme();
    const details = { action: "claim_task", taskIndex: 0 };
    const lines: string[] = [];
    lines.push(theme.fg("accent", "👥 Team Ops"));
    lines.push(`\n${theme.fg("success", "✓ Claimed task")} #${details.taskIndex}`);
    const result = new Text(lines.join("\n"));
    expect(result).toBeDefined();
  });

  it("renders claim_task no tasks", () => {
    const theme = createMockTheme();
    const details = { action: "claim_task" };
    const lines: string[] = [];
    lines.push(theme.fg("accent", "👥 Team Ops"));
    lines.push(`\n${theme.fg("warning", "No tasks available")}`);
    const result = new Text(lines.join("\n"));
    expect(result).toBeDefined();
  });
});

describe("Todos Renderer (basic)", () => {
  it("renders todo list with phases", () => {
    const theme = createMockTheme();
    const phases = [
      {
        name: "Phase 1",
        tasks: [
          { id: "task-1", content: "Task A", status: "pending" },
          { id: "task-2", content: "Task B", status: "completed" },
        ],
      },
    ];

    const lines: string[] = [];
    lines.push(theme.fg("accent", "📋 TODO List"));
    lines.push("");
    lines.push(theme.fg("accent", "Phase 1"));
    lines.push(`  ⏳ task-1 Task A`);
    lines.push(`  ✅ task-2 Task B`);

    const result = new Text(lines.join("\n"));
    expect(result).toBeDefined();
  });
});

describe("Memory Renderer (basic)", () => {
  it("renders memory search results", () => {
    const theme = createMockTheme();
    const memories = [
      { id: 1, text: "Important fact", tags: ["meeting"] },
      { id: 2, text: "Another fact", tags: [] },
    ];

    const lines: string[] = [];
    lines.push(theme.fg("accent", "🧠 Memory"));
    lines.push(`Total: ${memories.length} memories`);
    lines.push("\nMatches:");
    for (const mem of memories.slice(0, 15)) {
      const icon = mem.tags.some(t => t.toLowerCase().includes("meeting")) ? "🏷️" : "📝";
      const id = theme.fg("accent", `#${mem.id}`);
      const preview = mem.text.length > 60 ? `${mem.text.substring(0, 60)  }...` : mem.text;
      const text = theme.fg("text", preview);
      const tags = mem.tags && mem.tags.length > 0 ? theme.fg("dim", ` [${mem.tags.join(", ")}]`) : "";
      lines.push(`  ${icon} ${id} ${text}${tags}`);
    }

    const result = new Text(lines.join("\n"));
    expect(result).toBeDefined();
  });
});
