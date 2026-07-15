/**
 * Minimal Team Ops Tool
 *
 * Actions for child agents to collaborate:
 * - Task management: claim_task, release_task, complete_task, get_team_status
 * - Workspace: workspace_read, workspace_write
 * - Messaging: send_message, get_messages
 * - Status: update_status
 */

import type { ToolDefinition, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AgentTeam } from "./team-manager.js";

interface TeamOpsParams {
  action: string;
  taskIndex?: number;
  result?: string;
  key?: string;
  value?: string;
  channel?: string;
  content?: string;
  status?: string;
  limit?: number;
}

interface TeamContext extends ExtensionContext {
  session: { sessionId: string };
}

/**
 * Create team_ops tool for child agents
 */

// Batch 13: Extract helpers to achieve ≤20-line functions
function parseTeamOpsParams(params: any): { parsed?: TeamOpsParams; error?: any } {
  if (typeof params === "string") {
    try {
      return { parsed: JSON.parse(params) };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: { content: [{ type: "text" as const, text: `❌ Error: Invalid JSON string: ${message}` }], isError: true, details: { error: "Invalid JSON" } } };
    }
  } else if (typeof params === "object" && params !== null && "action" in params) {
    return { parsed: params as TeamOpsParams };
  }
  return { error: { content: [{ type: "text" as const, text: "Invalid parameters" }], isError: true, details: { error: "Invalid parameters" } } };
}

function ensureTeamContext(ctx: ExtensionContext): { sessionId: string } | { error: any } {
  if (!('session' in ctx) || !(ctx as TeamContext).session?.sessionId) {
    return { error: { content: [{ type: "text" as const, text: "Team context missing session" }], isError: true, details: { error: "Missing session" } } };
  }
  return { sessionId: (ctx as TeamContext).session.sessionId };
}

// Handlers
async function handleClaimTask(team: AgentTeam, sessionId: string): Promise<any> {
  const taskIndex = await team.claimTask(sessionId);
  if (taskIndex !== null) {
    return {
      content: [{ type: "text" as const, text: `Claimed task ${taskIndex}: ${team.tasks[taskIndex]}` }],
      details: { taskIndex },
      isError: false,
    } as const;
  }
  return {
    content: [{ type: "text" as const, text: "No pending tasks available." }],
    details: undefined,
    isError: true,
  } as const;
}

async function handleReleaseTask(team: AgentTeam, sessionId: string): Promise<any> {
  const agentId = sessionId;
  const currentTask = await team.getMyCurrentTask(agentId);
  if (currentTask === null) {
    return {
      content: [{ type: "text" as const, text: "No active task to release." }],
      details: undefined,
      isError: true,
    } as const;
  }
  const released = await team.releaseTask(agentId, currentTask);
  if (released) {
    return {
      content: [{ type: "text" as const, text: `Released task ${currentTask}` }],
      details: { taskIndex: currentTask },
      isError: false,
    } as const;
  }
  return {
    content: [{ type: "text" as const, text: `Failed to release task ${currentTask}` }],
    details: undefined,
    isError: true,
  } as const;
}

async function handleCompleteTask(parsed: TeamOpsParams, team: AgentTeam, sessionId: string): Promise<any> {
  const { taskIndex, result } = parsed;
  if (taskIndex === undefined) {
    return {
      content: [{ type: "text" as const, text: "Missing taskIndex" }],
      details: undefined,
      isError: true,
    } as const;
  }
  const agentId = sessionId;
  const currentTask = await team.getMyCurrentTask(agentId);
  if (currentTask !== taskIndex) {
    return {
      content: [{ type: "text" as const, text: `Task ${taskIndex} is not assigned to you.` }],
      details: undefined,
      isError: true,
    } as const;
  }
  await team.completeTask(agentId, taskIndex, result || "");
  return {
    content: [{ type: "text" as const, text: `Completed task ${taskIndex}` }],
    details: { taskIndex, result },
    isError: false,
  } as const;
}

async function handleGetTeamStatus(team: AgentTeam): Promise<any> {
  const status = await team.getTeamStatus();
  return {
    content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }],
    details: status,
    isError: false,
  } as const;
}

async function handleWorkspaceRead(team: AgentTeam, key: string): Promise<any> {
  if (!key) {
    return {
      content: [{ type: "text" as const, text: "Missing key" }],
      isError: true,
      details: { error: "Missing key" }
    } as const;
  }
  const value = await team.workspaceRead(key);
  if (value === undefined) {
    return {
      content: [{ type: "text" as const, text: "(not found)" }],
      details: undefined,
      isError: false,
    } as const;
  }
  return {
    content: [{ type: "text" as const, text: value }],
    details: { key, value },
    isError: false,
  } as const;
}

async function handleWorkspaceWrite(team: AgentTeam, key: string, value: string, sessionId: string): Promise<any> {
  if (key === undefined || value === undefined) {
    return {
      content: [{ type: "text" as const, text: "Missing key or value" }],
      isError: true,
      details: { error: "Missing parameters" }
    } as const;
  }
  await team.workspaceWrite(key, value, sessionId);
  return {
    content: [{ type: "text" as const, text: `Wrote ${key}` }],
    details: { key },
    isError: false,
  } as const;
}

async function handleSendMessage(team: AgentTeam, channel: string, content: string, sessionId: string): Promise<any> {
  if (!content) {
    return {
      content: [{ type: "text" as const, text: "Missing content" }],
      isError: true,
      details: { error: "Missing content" }
    } as const;
  }
  if (!channel) {
    return {
      content: [{ type: "text" as const, text: "Missing channel" }],
      isError: true,
      details: { error: "Missing channel" }
    } as const;
  }
  await team.publishMessage(channel, sessionId, content);
  return {
    content: [{ type: "text" as const, text: `Sent message to ${channel}` }],
    details: { channel },
    isError: false,
  } as const;
}

async function handleGetMessages(team: AgentTeam, channel?: string, limit?: number): Promise<any> {
  const safeChannel = channel ?? '';
  const messages = await team.getMessages(safeChannel, limit);
  if (messages.length === 0) {
    return {
      content: [{ type: "text" as const, text: "(no messages)" }],
      details: { channel, messages: [] },
      isError: false,
    } as const;
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(messages, null, 2) }],
    details: { channel, messages, limit },
    isError: false,
  } as const;
}

async function handleUpdateStatus(parsed: TeamOpsParams): Promise<any> {
  const { status } = parsed;
  if (status === undefined) {
    return {
      content: [{ type: "text" as const, text: "Missing status" }],
      isError: true,
      details: { error: "Missing status" }
    } as const;
  }
  // No state change required; simply acknowledge.
  return {
    content: [{ type: "text" as const, text: `Status updated to: ${status}` }],
    details: { status },
    isError: false,
  } as const;
}

const teamOpsToolBase: Omit<ToolDefinition, 'execute'> = {
  name: "team_ops",
  label: "Team Ops",
  description: "Team collaboration: claim/release/complete tasks, workspace read/write, send/get messages, update status",
  promptSnippet: "Manage tasks, workspace, and communication within a team",
  promptGuidelines: [
    "This tool is exclusively available to team member agents (child agents), NOT the main agent.",
    "Use team_ops to interact with your team during collaborative work.",
    "Start with action='claim_task' to get a task from the queue.",
    "After completing work, use action='complete_task' with taskIndex and result.",
    "Share data via workspace_write(key, value) and retrieve with workspace_read(key).",
    "Communicate with teammates using send_message(channel, content).",
    "Check team status with get_team_status to see progress.",
    "Release tasks you cannot complete with release_task to free them for others.",
    "Note: Team members run autonomously in a loop - claim, work, complete, repeat.",
    "Main agent cannot directly control team members; coordination happens via workspace and messages."
  ],
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "claim_task",
          "release_task",
          "complete_task",
          "get_team_status",
          "workspace_read",
          "workspace_write",
          "send_message",
          "get_messages",
          "update_status",
        ],
        description: "Action to perform"
      },
      // Task params
      taskIndex: { type: "number", description: "Task index (for complete_task)" },
      result: { type: "string", description: "Task result (for complete_task)" },
      // Workspace params
      key: { type: "string", description: "Workspace key" },
      value: { type: "string", description: "Value to write (string)" },
      // Messaging params
      channel: { type: "string", description: "Channel (default: team.chat)" },
      content: { type: "string", description: "Message content" },
      // Status params
      status: { type: "string", description: "Agent status (idle, working, etc.)" },
    },
    required: ["action"]
  }
};

export function createTeamOpsTool(team: AgentTeam): ToolDefinition {
  const actionHandlers: Record<string, (p: TeamOpsParams, sessionId: string) => Promise<any>> = {
    claim_task: (_p, sessionId) => handleClaimTask(team, sessionId),
    release_task: (_p, sessionId) => handleReleaseTask(team, sessionId),
    complete_task: (p, sessionId) => handleCompleteTask(p, team, sessionId),
    get_team_status: (_p, _sessionId) => handleGetTeamStatus(team),
    workspace_read: (p, _sessionId) => handleWorkspaceRead(team, p.key!),
    workspace_write: (p, sessionId) => handleWorkspaceWrite(team, p.key!, p.value!, sessionId),
    send_message: (p, sessionId) => handleSendMessage(team, p.channel!, p.content!, sessionId),
    get_messages: (p, _sessionId) => handleGetMessages(team, p.channel, p.limit),
    update_status: (p, _sessionId) => handleUpdateStatus(p)
  };
  return {
    ...teamOpsToolBase,
    execute: async (toolCallId, params, signal, onUpdate, ctx) => {
      const parseResult = parseTeamOpsParams(params);
      if (parseResult.error) return parseResult.error;
      const parsed = parseResult.parsed!;
      const teamCtx = ensureTeamContext(ctx);
      if ('error' in teamCtx) return teamCtx.error;
      const { sessionId } = teamCtx;
      const handler = actionHandlers[parsed.action];
      if (!handler) {
        return { content: [{ type: "text" as const, text: `Unknown action: ${parsed.action}` }], isError: true, details: { error: "Invalid action" } };
      }
      try {
        return await handler(parsed, sessionId);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        return {
          content: [{ type: "text" as const, text: `❌ Error: ${message}` }],
          details: { error: message, stack },
          isError: true
        };
      }
    }
  };
}