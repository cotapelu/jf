/**
 * Minimal Team Ops Tool
 *
 * Actions for child agents to collaborate:
 * - Task management: claim_task, release_task, complete_task, get_team_status
 * - Workspace: workspace_read, workspace_write
 * - Messaging: send_message, get_messages
 * - Status: update_status
 */

import type { ToolDefinition, ExtensionContext,  AgentToolUpdateCallback } from "@earendil-works/pi-coding-agent"; // AgentToolResult unused
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
export function createTeamOpsTool(team: AgentTeam): ToolDefinition {
  return {
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
    },
    async execute(
      toolCallId: string,
      params: any,
      signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      ctx: ExtensionContext
    ) {
      // Support LLM outputting JSON string
      let parsedParams: TeamOpsParams;
      if (typeof params === "string") {
        try {
          parsedParams = JSON.parse(params);
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          return {
            content: [{ type: "text" as const, text: `❌ Error: Invalid JSON string: ${message}` }],
            isError: true,
            details: { error: "Invalid JSON" }
          };
        }
      } else if (typeof params === "object" && params !== null && "action" in params) {
        parsedParams = params as TeamOpsParams;
      } else {
        return {
          content: [{ type: "text" as const, text: "Invalid parameters" }],
          isError: true,
          details: { error: "Invalid parameters" }
        };
      }

      const { action } = parsedParams;

      // Ensure team context with session
      if (!('session' in ctx) || !(ctx as TeamContext).session?.sessionId) {
        throw new Error("Team context missing session");
      }
      const teamCtx = ctx as TeamContext;
      const sessionId = teamCtx.session.sessionId;

      try {
        switch (action) {
          // ==================== TASK MANAGEMENT ====================
          case "claim_task": {
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

          case "release_task": {
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

          case "complete_task": {
            const { taskIndex, result } = parsedParams;
            const agentId = sessionId;
            if (taskIndex === undefined) {
              return {
                content: [{ type: "text" as const, text: "Missing taskIndex" }],
                details: undefined,
                isError: true,
              } as const;
            }
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

          case "get_team_status": {
            const status = await team.getTeamStatus();
            return {
              content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }],
              details: status,
              isError: false,
            } as const;
          }

          // ==================== WORKSPACE ====================
          case "workspace_read": {
            const { key } = parsedParams;
            if (!key) {
              return { content: [{ type: "text" as const, text: "Missing key" }], details: undefined, isError: true } as const;
            }
            const value = await team.workspaceRead(key);
            return {
              content: [{ type: "text" as const, text: value !== undefined ? String(value) : "(not found)" }],
              details: { key, value, exists: value !== undefined },
              isError: false,
            } as const;
          }

          case "workspace_write": {
            const { key, value } = parsedParams;
            if (!key || value === undefined) {
              return { content: [{ type: "text" as const, text: "Missing key or value" }], details: undefined, isError: true } as const;
            }
            await team.workspaceWrite(key, String(value), sessionId);
            return {
              content: [{ type: "text" as const, text: `Wrote to workspace key: ${key}` }],
              details: { key },
              isError: false,
            } as const;
          }

          // ==================== MESSAGING ====================
          case "send_message": {
            const { channel = "team.chat", content } = parsedParams;
            if (!content) {
              return { content: [{ type: "text" as const, text: "Missing content" }], details: undefined, isError: true } as const;
            }
            await team.publishMessage(channel, sessionId, content);
            return {
              content: [{ type: "text" as const, text: `Sent to ${channel}` }],
              details: { channel },
              isError: false,
            } as const;
          }

          case "get_messages": {
            const { channel = "team.chat", limit } = parsedParams;
            const msgs = await team.getMessages(channel, limit);
            const text = msgs.map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.from}: ${m.content}`).join("\n");
            return {
              content: [{ type: "text" as const, text: text || "(no messages)" }],
              details: { channel, messages: msgs },
              isError: false,
            } as const;
          }

          // ==================== STATUS ====================
          case "update_status": {
            const { status } = parsedParams;
            if (!status) {
              return { content: [{ type: "text" as const, text: "Missing status" }], details: undefined, isError: true } as const;
            }
            await team.getMyCurrentTask(sessionId); // ensures agent exists
            const current = await team.getMyCurrentTask(sessionId);
            // For simplicity, just record it; not used yet in minimal version
            return {
              content: [{ type: "text" as const, text: `Status updated to: ${status}` }],
              details: { status, currentTask: current },
              isError: false,
            } as const;
          }

          default:
            return {
              content: [{ type: "text" as const, text: `Unknown action: ${action}` }],
              details: undefined,
              isError: true,
            } as const;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          details: undefined,
          isError: true,
        } as const;
      }
    },
  };
}
