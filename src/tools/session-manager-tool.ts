import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { ParentChildSessionManager } from "../parent-child-session-manager.js";
import { getCurrentRuntime } from "../runtime-context.js";

// Singleton manager instance per runtime lifecycle
let manager: ParentChildSessionManager | null = null;

function getManager(): ParentChildSessionManager {
    if (!manager) {
        const runtime = getCurrentRuntime();
        manager = new ParentChildSessionManager(runtime);
    }
    return manager;
}

/**
 * Create the session_manager tool.
 *
 * This tool provides operations for managing a parent-child session pair:
 * - create_child: create a new child session (replaces any existing child)
 * - switch_to_parent: switch back to the parent session
 * - switch_to_child: switch to the current child session
 * - get_status: get information about both sessions and which is active
 * - dispose: dispose the entire runtime (both parent and child)
 *
 * The tool is stateful: it keeps a ParentChildSessionManager instance bound
 * to the current runtime context.
 */
export function createSessionManagerTool(): ToolDefinition {
    return {
        name: "session_manager",
        label: "Session Manager",
        description:
            "Internal tool for managing parent-child sessions. Use this to create a new child session for independent work, switch between sessions, and monitor status. Exactly 1 parent + 1 child supported.\n\n" +
            "Operations:\n" +
            "- create_child: Create a new child session (replaces any existing child). Use when starting a fresh independent task.\n" +
            "- switch_to_parent: Switch runtime to the parent session.\n" +
            "- switch_to_child: Switch runtime to the current child session.\n" +
            "- get_status: Get info about both sessions and which is active.\n" +
            "- dispose: Dispose entire runtime (both sessions), ending the session.",
        promptSnippet: "session_manager: manage parent-child sessions (create child, switch)",
        promptGuidelines: [
            "You have the ability to manage sessions via the `session_manager` tool.",
            "- Create a child session when starting a new independent task to avoid mixing contexts.",
            "- Switch back to parent to continue the original conversation.",
            "- Switch to child to resume the most recent independent work.",
            "- Check status with get_status if unsure.",
            "- Only one child session exists at a time; creating a new child replaces the old one.",
            "- Dispose when completely finished to free resources.",
        ],
        parameters: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["create_child", "switch_to_parent", "switch_to_child", "get_status", "dispose"],
                    description: "Hành động cần thực hiện",
                },
            },
            required: ["action"],
        },
        async execute(toolCallId: string, params: { action: string }): Promise<any> {
            const { action } = params;
            const mgr = getManager();

            switch (action) {
                case "create_child": {
                    await mgr.createChildSession();
                    return {
                        content: [
                            {
                                type: "text",
                                text: `✅ Created child session`,
                            },
                        ],
                        details: {
                            action: "create_child",
                            parent_session: mgr.parentSession.sessionFile,
                            child_session: mgr.childSession?.sessionFile,
                            active: mgr.isParentActive ? "parent" : "child",
                        },
                    };
                }

                case "switch_to_parent": {
                    await mgr.switchToParent();
                    return {
                        content: [
                            {
                                type: "text",
                                text: `🔄 Switched to parent session`,
                            },
                        ],
                        details: {
                            action: "switch_to_parent",
                            active_session: mgr.parentSession.sessionFile,
                            active: "parent",
                        },
                    };
                }

                case "switch_to_child": {
                    await mgr.switchToChild();
                    return {
                        content: [
                            {
                                type: "text",
                                text: `🔄 Switched to child session`,
                            },
                        ],
                        details: {
                            action: "switch_to_child",
                            active_session: mgr.childSession?.sessionFile,
                            active: "child",
                        },
                    };
                }

                case "get_status": {
                    const status = {
                        parent_session: mgr.parentSession.sessionFile,
                        child_session: mgr.childSession?.sessionFile ?? null,
                        active: mgr.isParentActive ? "parent" : "child",
                        runtime_session: mgr.session.sessionFile,
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text: `📊 Session Status:\n` +
                                    `• Parent: ${status.parent_session}\n` +
                                    `• Child: ${status.child_session || "(none)"}\n` +
                                    `• Active: ${status.active}`,
                            },
                        ],
                        details: status,
                    };
                }

                case "dispose": {
                    await mgr.dispose();
                    manager = null; // reset singleton
                    return {
                        content: [
                            {
                                type: "text",
                                text: `🗑️ Disposed all sessions`,
                            },
                        ],
                        details: { action: "dispose", note: "Manager cleared" },
                    };
                }

                default: {
                    throw new Error(`Unknown action: ${action}. Valid actions: create_child, switch_to_parent, switch_to_child, get_status, dispose`);
                }
            }
        },
    };
}
