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
        label: "Session Manager (Parent-Child)",
        description:
            "Quản lý parent-child sessions: tạo child session mới, chuyển đổi giữa parent và child, xem trạng thái. Chỉ hỗ trợ 1 parent + 1 child. Parent là session ban đầu, child là session làm việc con.\n\n" +
            "Actions:\n" +
            "- create_child: Tạo child session mới (nếu có child cũ sẽ bị thay thế)\n" +
            "- switch_to_parent: Chuyển runtime về parent session\n" +
            "- switch_to_child: Chuyển runtime về child session\n" +
            "- get_status: Xem thông tin cả parent và child\n" +
            "- dispose: Dispose toàn bộ runtime (kết thúc session)",
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
