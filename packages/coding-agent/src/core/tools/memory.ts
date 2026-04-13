/**
 * Memory Tool for pi coding agent
 * Stores and retrieves persistent information across sessions
 */

import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/pi-agent-core";
import type { MemoryType } from "@mariozechner/pi-coding-memory";
import { createMemoryEngine, createSQLiteStore } from "@mariozechner/pi-coding-memory";
import { type Static, Type } from "@sinclair/typebox";
import type { AgentSession } from "../agent-session.js";

// =============================================================================
// Types
// =============================================================================

export interface MemoryToolDetails {
	total?: number;
	memories?: Array<{
		id: string;
		content: string;
		type: string;
		tags: string[];
		created_at: number;
	}>;
	saved?: { id: string; type: string };
	deleted?: boolean;
	byType?: Record<string, number>;
	byTags?: Record<string, number>;
	error?: string;
}

// =============================================================================
// Schema - Unified memory operations (like todo-write)
// =============================================================================

const SaveOp = Type.Object({
	op: Type.Literal("save"),
	content: Type.String({ description: "The information to save (max 10000 chars)" }),
	type: Type.Union(
		[
			Type.Literal("preference"),
			Type.Literal("project"),
			Type.Literal("command"),
			Type.Literal("solution"),
			Type.Literal("note"),
		],
		{
			description:
				"Type of memory: preference (user coding style), project (project facts), command (workflows), solution (bug fixes), note (general)",
		},
	),
	tags: Type.Optional(Type.Array(Type.String(), { description: "Optional tags for categorization" })),
	weight: Type.Optional(Type.Number({ minimum: 0, maximum: 1, description: "Importance 0-1, default 0.5" })),
	expires_at: Type.Optional(Type.Number({ description: "Optional expiration timestamp (Unix ms)" })),
});

const FindOp = Type.Object({
	op: Type.Literal("find"),
	query: Type.String({ description: "Search query (e.g., 'python indentation', 'database')" }),
	type: Type.Optional(
		Type.Union(
			[
				Type.Literal("preference"),
				Type.Literal("project"),
				Type.Literal("command"),
				Type.Literal("solution"),
				Type.Literal("note"),
			],
			{ description: "Optional filter by memory type" },
		),
	),
	tags: Type.Optional(Type.Array(Type.String(), { description: "Optional filter by tags (AND logic)" })),
	limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, description: "Max results, default 10" })),
});

const ForgetOp = Type.Object({
	op: Type.Literal("forget"),
	id: Type.String({ description: "Memory ID to delete" }),
});

const StatsOp = Type.Object({
	op: Type.Literal("stats"),
});

const memoryOpsSchema = Type.Union([SaveOp, FindOp, ForgetOp, StatsOp]);

export const memorySchema = Type.Object({
	op: memoryOpsSchema,
});

type MemoryParams = Static<typeof memorySchema>;

// =============================================================================
// Tool Class
// =============================================================================

export class MemoryTool implements AgentTool<typeof memorySchema, MemoryToolDetails> {
	readonly name = "memory";
	readonly label = "Memory";
	readonly description =
		"Store and retrieve persistent information across sessions. Use to remember user preferences, project facts, commands, and solutions.";
	readonly promptSnippet = "memory: store and retrieve persistent info";
	readonly promptGuidelines = [
		"Use memory to save important information when user shares preferences, project details, or solutions",
		"Recall information from memory BEFORE making assumptions about user's setup",
		"Never save API keys or sensitive data to memory",
	];
	readonly parameters = memorySchema;
	readonly concurrency = "parallel";
	readonly strict = true;

	private _engine: ReturnType<typeof createMemoryEngine> | undefined;

	constructor(private session: AgentSession) {
		// Lazy init - create engine on first use
	}

	private getEngine(): ReturnType<typeof createMemoryEngine> {
		if (!this._engine) {
			// Store in session dir or default location
			const sessionDir = this.session.sessionDir;
			const { join } = require("path");
			const memoryPath = sessionDir
				? join(sessionDir, "..", "memory.db")
				: join(process.env.HOME || ".", ".pi", "agent", "memory.db");

			const store = createSQLiteStore(memoryPath);
			this._engine = createMemoryEngine(store);
		}
		return this._engine;
	}

	async execute(
		_toolCallId: string,
		params: MemoryParams,
		_signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<MemoryToolDetails>,
		_context?: unknown,
	): Promise<AgentToolResult<MemoryToolDetails>> {
		const op = params.op;

		try {
			switch (op.op) {
				case "save": {
					const result = this.getEngine().save({
						content: op.content,
						type: op.type as MemoryType,
						tags: op.tags,
						weight: op.weight,
						expires_at: op.expires_at,
					});

					if (!result.ok) {
						return {
							content: [{ type: "text", text: `Error: ${result.error}` }],
							details: { error: result.error },
						};
					}
					return {
						content: [{ type: "text", text: `Saved to ${op.type}: ${op.content.substring(0, 100)}` }],
						details: { saved: { id: result.value.id, type: result.value.type } },
					};
				}

				case "find": {
					const result = this.getEngine().find(op.query, {
						type: op.type as MemoryType | undefined,
						tags: op.tags,
						limit: op.limit,
					});

					if (!result.ok) {
						return {
							content: [{ type: "text", text: `Error: ${result.error}` }],
							details: { error: result.error },
						};
					}
					const summary =
						result.value.memories.length > 0
							? `Found ${result.value.total} memories:\n${result.value.memories.map((m) => `- [${m.type}] ${m.content.substring(0, 80)}`).join("\n")}`
							: `No memories found for "${op.query}"`;
					return {
						content: [{ type: "text", text: summary }],
						details: {
							total: result.value.total,
							memories: result.value.memories.map((m) => ({
								id: m.id,
								content: m.content,
								type: m.type,
								tags: m.tags,
								created_at: m.created_at,
							})),
						},
					};
				}

				case "forget": {
					const result = this.getEngine().delete(op.id);

					if (!result.ok) {
						return {
							content: [{ type: "text", text: `Error: ${result.error}` }],
							details: { error: result.error },
						};
					}
					const message = result.value ? "Memory deleted" : "Memory not found";
					return {
						content: [{ type: "text", text: message }],
						details: { deleted: result.value },
					};
				}

				case "stats": {
					const result = this.getEngine().stats();

					if (!result.ok) {
						return {
							content: [{ type: "text", text: `Error: ${result.error}` }],
							details: { error: result.error },
						};
					}
					const summary = `Memory Stats:\n- Total: ${result.value.total}\n- By type: ${JSON.stringify(result.value.byType)}\n- By tags: ${JSON.stringify(result.value.byTags)}`;
					return {
						content: [{ type: "text", text: summary }],
						details: {
							total: result.value.total,
							byType: result.value.byType,
							byTags: result.value.byTags,
						},
					};
				}

				default:
					return {
						content: [{ type: "text", text: `Unknown op: ${(op as any).op}` }],
						details: { error: `Unknown op: ${(op as any).op}` },
					};
			}
		} catch (e) {
			const error = e as Error;
			return {
				content: [{ type: "text", text: error.message }],
				details: { error: error.message },
			};
		}
	}
}
