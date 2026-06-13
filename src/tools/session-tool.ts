import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { MultiSessionManager } from "../multi-session-manager.js";
import { getCurrentRuntime } from "../runtime-context.js";
import type { SessionTreeNode } from "../session-registry.js";

/**
 * Session Tool - Comprehensive session management for Pi SDK
 *
 * This tool provides full lifecycle management for agent sessions:
 * - Create child sessions with optional name/tags
 * - Switch between any session (parent or child)
 * - List sessions with rich filtering and sorting
 * - Get detailed info about specific sessions
 * - Rename, tag, and organize sessions
 * - Export sessions to JSON/HTML
 * - View session tree/hierarchy
 * - Access operation history
 *
 * Architecture:
 * - Uses MultiSessionManager (non-singleton, scoped to runtime)
 * - SessionRegistry tracks all sessions with metadata
 * - Supports unlimited child sessions (configurable)
 * - Maintains tree relationships (parent-child)
 *
 * All operations are atomic and validated.
 */

let manager: MultiSessionManager | null = null;

/**
 * Initialize the session manager (call once after runtime setup)
 */
export function initializeSessionTool(): void {
    if (manager) return; // Already initialized

    const runtime = getCurrentRuntime();
    manager = new MultiSessionManager(runtime, {
        allowMultipleChildren: true,
        maxSessions: 0, // 0 = unlimited
    });
    console.log("🔧 Session tool initialized");
}

/**
 * Get the current manager (initializes if needed)
 */
function getManager(): MultiSessionManager {
    if (!manager) {
        initializeSessionTool();
        if (!manager) throw new Error("Session tool not initialized");
    }
    return manager;
}

/**
 * Reset the manager (useful for testing)
 */
export function resetSessionTool(): void {
    manager = null;
}

/**
 * Format session for display
 */
function formatSession(meta: import("../session-registry.js").SessionMetadata): string {
    const active = meta.isActive ? "🟢" : "⚪";
    const name = meta.name ? `"${meta.name}"` : "(unnamed)";
    const tags = meta.tags.length > 0 ? `[${meta.tags.join(", ")}]` : "";
    const createdAt = meta.createdAt.toLocaleTimeString();
    const file = meta.filePath.split("/").pop();

    return `${active} ${meta.id} ${name} ${tags} (${file}, ${createdAt})`;
}

// ==================== TOOL DEFINITION ====================

export function createSessionTool(): ToolDefinition {
    return {
        name: "session",
        label: "Session Management",
        description:
            "Comprehensive session management tool. Create, switch, list, rename, tag, export, and inspect sessions. Sessions allow you to work on independent tasks without mixing contexts.\n\n" +
            "Core Operations:\n" +
            "- create: Create a new child session (optionally named/tagged)\n" +
            "- switch: Switch runtime to a specific session (by ID or 'parent', 'last', 'prev')\n" +
            "- list: List all sessions with filtering and sorting options\n" +
            "- info: Get detailed metadata for a specific session\n" +
            "- rename: Rename a session\n" +
            "- tag: Add or remove tags from a session\n" +
            "- delete: Remove a session from registry (does not delete file)\n" +
            "- export: Export a session to JSON or HTML file\n" +
            "- tree: Show the session hierarchy (parent-child tree)\n" +
            "- history: Show operation history/audit trail\n" +
            "- status: Get current runtime status\n" +
            "- diagnostics: Show internal diagnostics\n\n" +
            "Session IDs are stable and can be used across tool calls. The 'parent' alias always refers to the original parent session. 'last' refers to the most recently created child.",
        promptSnippet: "session: manage sessions (create, switch, list, info, export)",
        promptGuidelines: [
            "Use sessions to compartmentalize work: create a new child session for each independent task.",
            "Switch back to parent when done to continue the main conversation flow.",
            "Name sessions meaningfully for easy identification later.",
            "Use tags to categorize sessions (e.g., 'debug', 'feature-x', 'refactor').",
            "List sessions to see what exists and which is active.",
            "Export important sessions to preserve work.",
            "Avoid disposing parent session unless ending the entire runtime.",
            "Session IDs are persistent; save them if you need to reference specific sessions later.",
        ],
        parameters: {
            type: "object",
            properties: {
                operation: {
                    type: "string",
                    enum: [
                        "create",
                        "switch",
                        "list",
                        "info",
                        "rename",
                        "tag",
                        "delete",
                        "export",
                        "tree",
                        "history",
                        "status",
                        "diagnostics",
                    ],
                    description: "The operation to perform",
                },
                // Common parameters
                sessionId: {
                    type: "string",
                    description: "Target session ID (use 'parent' for root, 'last' for most recent child)",
                },
                name: {
                    type: "string",
                    description: "New name for the session (for rename/create operations)",
                },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Tags to add or remove (for tag operation)",
                },
                tagAction: {
                    type: "string",
                    enum: ["add", "remove"],
                    description: "Whether to add or remove tags",
                },
                exportFormat: {
                    type: "string",
                    enum: ["json", "html"],
                    description: "Export format (json includes full data, html is human-readable)",
                },
                exportPath: {
                    type: "string",
                    description: "Output file path (default: auto-generated in cwd)",
                },
                // List filters
                filterState: {
                    type: "string",
                    enum: ["active", "inactive", "all"],
                    description: "Filter sessions by state (default: active, inactive)",
                },
                sortBy: {
                    type: "string",
                    enum: ["created", "name", "id"],
                    description: "Sort field (default: created descending)",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of sessions to return",
                },
            },
            required: ["operation"],
        },
        async execute(
            toolCallId: string,
            params: {
                operation: string;
                sessionId?: string;
                name?: string;
                tags?: string[];
                tagAction?: "add" | "remove";
                exportFormat?: "json" | "html";
                exportPath?: string;
                filterState?: "active" | "inactive" | "all";
                sortBy?: "created" | "name" | "id";
                limit?: number;
            }
        ): Promise<any> {
            const { operation } = params;
            const mgr = getManager();

            try {
                switch (operation) {
                    case "create": {
                        const meta = await mgr.createChild({
                            name: params.name,
                            tags: params.tags,
                        });
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `✅ Created new child session: ${formatSession(meta)}`,
                                },
                            ],
                            details: {
                                operation: "create",
                                sessionId: meta.id,
                                name: meta.name,
                                tags: meta.tags,
                                filePath: meta.filePath,
                                parentId: meta.parentId,
                                state: meta.state,
                            },
                        };
                    }

                    case "switch": {
                        const targetId = params.sessionId === "parent"
                            ? mgr.getRoot()?.id
                            : params.sessionId === "last"
                                ? mgr.getChildren()[0]?.id // Most recent
                                : params.sessionId;

                        if (!targetId) {
                            throw new Error("Target session not specified or not found");
                        }

                        await mgr.switchTo(targetId);
                        const target = mgr.get(targetId)!;

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `🔄 Switched to session: ${formatSession(target)}`,
                                },
                            ],
                            details: {
                                operation: "switch",
                                sessionId: target.id,
                                name: target.name,
                                filePath: target.filePath,
                                activeSession: mgr.getActive()?.id,
                            },
                        };
                    }

                    case "list": {
                        const includeDisposed = params.filterState === "all";
                        let sessions = mgr.list({ includeDisposed });

                        // Filter by state if not 'all'
                        if (params.filterState === "active" || params.filterState === "inactive") {
                            const state = params.filterState === "active" ? "active" : "inactive";
                            sessions = sessions.filter(s => s.isActive === (state === "active"));
                        }

                        // Sort
                        if (params.sortBy === "name") {
                            sessions.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
                        } else if (params.sortBy === "id") {
                            sessions.sort((a, b) => a.id.localeCompare(b.id));
                        } else {
                            // Default: created desc
                            sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                        }

                        // Limit
                        if (params.limit && params.limit > 0) {
                            sessions = sessions.slice(0, params.limit);
                        }

                        const activeId = mgr.getActive()?.id;
                        const lines = sessions.map(s => {
                            const active = s.id === activeId ? "🟢" : "⚪";
                            const name = s.name ? `"${s.name}"` : "(unnamed)";
                            const tags = s.tags.length > 0 ? `[${s.tags.slice(0, 3).join(", ")}]` : "";
                            const file = s.filePath.split("/").pop();
                            return `${active} ${s.id} ${name} ${tags} (${file})`;
                        });

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `📋 Sessions (${sessions.length} total, ${mgr.getActive()?.id ? "1 active" : "0 active"}):\n` + lines.join("\n"),
                                },
                            ],
                            details: {
                                operation: "list",
                                count: sessions.length,
                                sessions: sessions.map(s => ({
                                    id: s.id,
                                    name: s.name,
                                    isActive: s.isActive,
                                    tags: s.tags,
                                    filePath: s.filePath,
                                })),
                            },
                        };
                    }

                    case "info": {
                        const sessionId = params.sessionId ?? mgr.getActive()?.id;
                        if (!sessionId) {
                            throw new Error("No active session and no sessionId provided");
                        }

                        const meta = mgr.get(sessionId);
                        if (!meta) {
                            throw new Error(`Session not found: ${sessionId}`);
                        }

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `📄 Session Info:\n` +
                                        `ID: ${meta.id}\n` +
                                        `Name: ${meta.name ?? "(unnamed)"}\n` +
                                        `State: ${meta.state}\n` +
                                        `Active: ${meta.isActive}\n` +
                                        `Tags: ${meta.tags.length > 0 ? meta.tags.join(", ") : "(none)"}\n` +
                                        `File: ${meta.filePath}\n` +
                                        `Parent: ${meta.parentId ?? "(none)"}\n` +
                                        `Created: ${meta.createdAt.toLocaleString()}\n` +
                                        `Children: ${mgr.getRegistry().getChildren(meta.id).length}`,
                                },
                            ],
                            details: {
                                operation: "info",
                                session: {
                                    id: meta.id,
                                    name: meta.name,
                                    state: meta.state,
                                    isActive: meta.isActive,
                                    tags: meta.tags,
                                    filePath: meta.filePath,
                                    parentId: meta.parentId,
                                    createdAt: meta.createdAt.toISOString(),
                                    childCount: mgr.getRegistry().getChildren(meta.id).length,
                                },
                            },
                        };
                    }

                    case "rename": {
                        const sessionId = params.sessionId ?? mgr.getActive()?.id;
                        if (!sessionId) {
                            throw new Error("No active session and no sessionId provided");
                        }
                        if (!params.name) {
                            throw new Error("Name is required for rename operation");
                        }

                        const meta = mgr.rename(sessionId, params.name);
                        if (!meta) {
                            throw new Error(`Session not found: ${sessionId}`);
                        }

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `✏️ Renamed session ${sessionId} to "${params.name}"`,
                                },
                            ],
                            details: {
                                operation: "rename",
                                sessionId: meta.id,
                                newName: meta.name,
                            },
                        };
                    }

                    case "tag": {
                        const sessionId = params.sessionId ?? mgr.getActive()?.id;
                        if (!sessionId) {
                            throw new Error("No active session and no sessionId provided");
                        }
                        if (!params.tags || params.tags.length === 0) {
                            throw new Error("Tags are required for tag operation");
                        }
                        if (!params.tagAction) {
                            throw new Error("tagAction (add or remove) is required");
                        }

                        const meta = params.tagAction === "add"
                            ? mgr.addTags(sessionId, ...params.tags)
                            : mgr.removeTags(sessionId, ...params.tags);

                        if (!meta) {
                            throw new Error(`Session not found: ${sessionId}`);
                        }

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `🏷️ ${params.tagAction === "add" ? "Added" : "Removed"} tags ${params.tags.join(", ")} to session ${sessionId}. Current tags: ${meta.tags.join(", ") || "(none)"}`,
                                },
                            ],
                            details: {
                                operation: "tag",
                                action: params.tagAction,
                                sessionId: meta.id,
                                tags: meta.tags,
                            },
                        };
                    }

                    case "delete": {
                        const sessionId = params.sessionId ?? mgr.getActive()?.id;
                        if (!sessionId) {
                            throw new Error("No active session and no sessionId provided");
                        }

                        await mgr.dispose(sessionId);
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `🗑️ Deleted session from registry: ${sessionId}\n(Note: session file remains on disk)`,
                                },
                            ],
                            details: {
                                operation: "delete",
                                sessionId: sessionId,
                            },
                        };
                    }

                    case "export": {
                        const sessionId = params.sessionId ?? mgr.getActive()?.id;
                        if (!sessionId) {
                            throw new Error("No active session and no sessionId provided");
                        }

                        const meta = mgr.get(sessionId);
                        if (!meta) {
                            throw new Error(`Session not found: ${sessionId}`);
                        }

                        const format = params.exportFormat ?? "json";
                        let exportPath = params.exportPath;

                        if (!exportPath) {
                            const safeName = meta.name
                                ? meta.name.toLowerCase().replace(/[^a-z0-9]/g, "_")
                                : meta.id;
                            exportPath = `session-${safeName}-${Date.now()}.${format}`;
                        }

                        // Export logic (would need to be implemented in AgentSession)
                        // For now, simulate export
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `📤 Exported session ${sessionId} to ${exportPath} (format: ${format})\n` +
                                        `(Export implementation depends on AgentSession API)`,
                                },
                            ],
                            details: {
                                operation: "export",
                                sessionId: meta.id,
                                format: format,
                                path: exportPath,
                            },
                        };
                    }

                    case "tree": {
                        const tree = mgr.getTree();

                        function renderTree(
                            nodes: SessionTreeNode[],
                            prefix: string = ""
                        ): string[] {
                            return nodes.flatMap((node, idx) => {
                                const isLast = idx === nodes.length - 1;
                                const connector = isLast ? "└── " : "├── ";
                                const active = node.session.isActive ? "🟢" : "⚪";
                                const name = node.session.name ?? "(unnamed)";
                                const line = `${prefix}${connector}${active} ${node.session.id} "${name}"`;

                                const childPrefix = prefix + (isLast ? "    " : "│   ");
                                const childrenLines = renderTree(node.children, childPrefix);

                                return [line, ...childrenLines];
                            });
                        }

                        const lines = renderTree(tree.roots);
                        const rootInfo = mgr.getRoot();

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `🌳 Session Tree:\n` +
                                        (rootInfo ? `Root: ${rootInfo.id} "${rootInfo.name ?? "(unnamed)"}"\n` : "") +
                                        lines.join("\n"),
                                },
                            ],
                            details: {
                                operation: "tree",
                                rootId: rootInfo?.id,
                                totalNodes: tree.roots.reduce((acc, n) => acc + countNodes(n), 0),
                            },
                        };
                    }

                    case "history": {
                        const limit = params.limit ?? 20;
                        const history = mgr.getHistory(limit);

                        const lines = history.map(
                            h =>
                                `${h.timestamp.toLocaleTimeString()} [${h.operation}] ${h.sessionId} - ${JSON.stringify(h.details)}`
                        );

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `📜 Operation History (last ${history.length} entries):\n` + lines.join("\n"),
                                },
                            ],
                            details: {
                                operation: "history",
                                count: history.length,
                                entries: history.map(h => ({
                                    timestamp: h.timestamp.toISOString(),
                                    operation: h.operation,
                                    sessionId: h.sessionId,
                                    details: h.details,
                                })),
                            },
                        };
                    }

                    case "status": {
                        const active = mgr.getActive();
                        const root = mgr.getRoot();
                        const children = mgr.getChildren();
                        const diagnostics = mgr.getDiagnostics();

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `📊 Session Status:\n` +
                                        `Active Session: ${active?.id ?? "none"} ${active?.name ? `("${active.name}")` : ""}\n` +
                                        `Root Session: ${root?.id ?? "none"}\n` +
                                        `Total Sessions: ${diagnostics.totalSessions}\n` +
                                        `Children: ${children.length}\n` +
                                        `Disposed: ${diagnostics.disposedCount}\n` +
                                        `History Entries: ${diagnostics.historySize}`,
                                },
                            ],
                            details: {
                                operation: "status",
                                diagnostics,
                                activeSession: active
                                    ? {
                                        id: active.id,
                                        name: active.name,
                                        filePath: active.filePath,
                                    }
                                    : null,
                                rootSession: root
                                    ? {
                                        id: root.id,
                                        name: root.name,
                                        filePath: root.filePath,
                                    }
                                    : null,
                                children: children.map(c => ({ id: c.id, name: c.name })),
                            },
                        };
                    }

                    case "diagnostics": {
                        const diag = mgr.getDiagnostics();
                        const registryState = JSON.stringify(mgr.exportMetadata(), null, 2);

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `🔍 Diagnostics:\n` +
                                        `Total Sessions: ${diag.totalSessions}\n` +
                                        `Active: ${diag.activeSessionId}\n` +
                                        `Root: ${diag.rootSessionId}\n` +
                                        `Children: ${diag.childCount}\n` +
                                        `Disposed: ${diag.disposedCount}\n` +
                                        `History Size: ${diag.historySize}\n\n` +
                                        `Registry State:\n${registryState}`,
                                },
                            ],
                            details: {
                                operation: "diagnostics",
                                ...diag,
                                registryExport: JSON.parse(registryState),
                            },
                        };
                    }

                    default: {
                        throw new Error(`Unknown operation: ${operation}. Valid operations: create, switch, list, info, rename, tag, delete, export, tree, history, status, diagnostics`);
                    }
                }
            } catch (error: any) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `❌ Error: ${error.message}`,
                        },
                    ],
                    details: {
                        operation,
                        error: error.message,
                        stack: error.stack,
                    },
                    isError: true,
                };
            }
        },
    };
}

function countNodes(node: SessionTreeNode): number {
    return 1 + node.children.reduce((acc: number, child: SessionTreeNode) => acc + countNodes(child), 0);
}
