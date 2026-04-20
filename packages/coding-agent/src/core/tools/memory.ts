/**
 * Memory Tool for pi coding agent
 * Stores and retrieves persistent information across sessions
 */

import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "@quangtynu/pi-agent-core";
import type { MemoryType } from "@quangtynu/pi-coding-memory";
import { createMemoryEngine, createSQLiteStore } from "@quangtynu/pi-coding-memory";
import { type Static, Type } from "@sinclair/typebox";
import { join } from "path";

// =============================================================================
// Types
// =============================================================================

export interface MemoryToolDetails {
	total?: number;
	shown?: number;
	memories?: Array<{
		id: string;
		content: string;
		type: string;
		tags: string[];
		created_at: number;
	}>;
	saved?: { id: string; type: string };
	deleted?: boolean;
	updated?: boolean;
	memory?: { id: string; content: string; type: string; tags: string[] };
	message?: string;
	byType?: Record<string, number>;
	byTags?: Record<string, number>;
	error?: string;
}

// =============================================================================
// Schema - Nested memory operations (like toolcall format)
// =============================================================================

const SaveOp = Type.Object({
	content: Type.String({
		description: "The information to save (max 10000 chars)",
	}),
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
	tags: Type.Optional(
		Type.Union(
			[
				Type.Array(Type.String(), {
					description: "Optional tags for categorization",
				}),
				Type.String(),
			],
			{
				description: "Optional tags for categorization (array or JSON string)",
			},
		),
	),
	weight: Type.Optional(
		Type.Number({
			minimum: 0,
			maximum: 1,
			description: "Importance 0-1, default 0.5",
		}),
	),
	expires_at: Type.Optional(
		Type.Number({
			description: "Optional expiration timestamp (Unix ms)",
		}),
	),
});

const FindOp = Type.Object({
	query: Type.String({
		description: "Search query (e.g., 'python indentation', 'database')",
	}),
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
	tags: Type.Optional(
		Type.Union(
			[
				Type.Array(Type.String(), {
					description: "Optional filter by tags (AND logic)",
				}),
				Type.String(),
			],
			{
				description: "Optional filter by tags (AND logic) (array or JSON string)",
			},
		),
	),
	limit: Type.Optional(
		Type.Number({
			minimum: 1,
			maximum: 100,
			description: "Max results, default 10",
		}),
	),
});

const GetOpParams = Type.Object({
	id: Type.String({ description: "Memory ID to retrieve" }),
});

const ForgetOpParams = Type.Object({
	id: Type.String({ description: "Memory ID to delete" }),
});

const UpdateOp = Type.Object({
	id: Type.String({ description: "Memory ID to update" }),
	content: Type.Optional(Type.String({ minLength: 1, maxLength: 10000 })),
	tags: Type.Optional(Type.Union([Type.Array(Type.String({ maxLength: 50 }), { max: 20 }), Type.String()])),
	weight: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
	expires_at: Type.Optional(Type.Number()),
	metadata: Type.Optional(Type.Any()),
});

const ListOpParams = Type.Object({
	limit: Type.Optional(
		Type.Number({
			minimum: 1,
			maximum: 1000,
			description: "Max memories to list, default 100",
		}),
	),
});

const StatsOpParams = Type.Object({});

// Nested schema: object with optional keys for each operation
const memoryOpsSchema = Type.Object({
	save: Type.Optional(SaveOp),
	find: Type.Optional(FindOp),
	get: Type.Optional(GetOpParams),
	list: Type.Optional(ListOpParams),
	forget: Type.Optional(ForgetOpParams),
	update: Type.Optional(UpdateOp),
	stats: Type.Optional(StatsOpParams),
});

export const memorySchema = memoryOpsSchema;

type MemoryParams = Static<typeof memorySchema>;

// =============================================================================
// Tool Class
// =============================================================================

export class MemoryTool implements AgentTool<typeof memorySchema, MemoryToolDetails> {
	readonly name = "memory";
	readonly label = "Memory";
	readonly description =
		"Store and retrieve persistent information across sessions. Use to remember user preferences, project facts, commands, and solutions.";
	readonly promptSnippet =
		"Store/retrieve: { find: { q:'dark' }, save:{ c:'x', type:'preference' }, get:{ id:'x' }, list:{ l:5 }";
	readonly promptGuidelines = [
		"Nested format: { op: { params } } e.g., { find: { query: 'dark' } }, { save: { content: 'x', type: 'preference' } }",
		"Ops: save(content, type[preference|project|command|solution|note], tags?, weight?), find(query, type?, tags?, limit?), get(id), list(limit?), stats(), forget(id), update(id, content?)",
		"Types: preference (user style), project (facts), command (workflows), solution (bug fixes), note (general)",
		"Search memory before assuming user setup. Never save API keys.",
	];
	readonly parameters = memorySchema;
	readonly concurrency = "parallel";
	readonly strict = true;

	private _engine: ReturnType<typeof createMemoryEngine> | undefined;

	private getEngine(): ReturnType<typeof createMemoryEngine> {
		if (!this._engine) {
			// Use current working directory for project-specific memory
			const memoryPath = join(process.cwd(), ".pi", "agent", "memory.db");
			const store = createSQLiteStore(memoryPath);
			this._engine = createMemoryEngine(store);
		}
		return this._engine;
	}

	// Helper to normalize tags (handle both array and JSON string)
	private normalizeTags(tags: string[] | string | undefined): string[] | undefined {
		if (!tags) return undefined;
		if (Array.isArray(tags)) return tags;
		if (typeof tags === "string") {
			try {
				const parsed = JSON.parse(tags);
				return Array.isArray(parsed) ? parsed : undefined;
			} catch {
				return undefined;
			}
		}
		return undefined;
	}

	async execute(
		_toolCallId: string,
		params: MemoryParams,
		_signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<MemoryToolDetails>,
		_context?: unknown,
	): Promise<AgentToolResult<MemoryToolDetails>> {
		// params is now nested: { save: {...} } or { find: {...} } or { get: {...} }
		try {
			// Detect which operation is being called
			if (params.save) {
				const op = params.save;
				const normalizedTags = this.normalizeTags(op.tags);
				const result = this.getEngine().save({
					content: op.content,
					type: op.type as MemoryType,
					tags: normalizedTags,
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
					content: [
						{
							type: "text",
							text: `Saved to ${op.type}: ${op.content.substring(0, 100)}`,
						},
					],
					details: {
						saved: { id: result.value.id, type: result.value.type },
					},
				};
			}

			if (params.find) {
				const op = params.find;
				const normalizedTags = this.normalizeTags(op.tags);
				const result = this.getEngine().find(op.query, {
					type: op.type as MemoryType | undefined,
					tags: normalizedTags,
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
						? `Found ${result.value.total} memories:\n${result.value.memories
								.map((m) => `- [${m.type}] ID: ${m.id}\n  ${m.content.substring(0, 80)}`)
								.join("\n")}`
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

			if (params.get) {
				const result = this.getEngine().get(params.get.id);
				if (!result.ok) {
					return {
						content: [{ type: "text", text: `Error: ${result.error}` }],
						details: { error: result.error },
					};
				}
				if (!result.value) {
					return {
						content: [{ type: "text", text: `Memory not found: ${params.get.id}` }],
						details: { message: "Memory not found" },
					};
				}
				const memory = result.value;
				const summary = `Memory [${memory.type}] (ID: ${memory.id}):
Content: ${memory.content}
Tags: ${memory.tags?.join(", ") || "none"}
Weight: ${memory.weight}
Created: ${new Date(memory.created_at).toISOString()}
Updated: ${new Date(memory.updated_at).toISOString()}`;
				return {
					content: [{ type: "text", text: summary }],
					details: {
						memory: {
							id: memory.id,
							content: memory.content,
							type: memory.type,
							tags: memory.tags,
						},
					},
				};
			}

			if (params.forget) {
				const result = this.getEngine().delete(params.forget.id);
				if (!result.ok) {
					return {
						content: [{ type: "text", text: `Error: ${result.error}` }],
						details: { error: result.error },
					};
				}
				if (!result.value) {
					return {
						content: [
							{
								type: "text",
								text: `Memory not found: ${params.forget.id}\n\nTo find available memories, use: memory({ find: { query: "your search term" } })\nor\nmemory({ stats: {} }) to see memory statistics.`,
							},
						],
						details: { deleted: false, message: "Memory not found" },
					};
				}
				return {
					content: [{ type: "text", text: "Memory deleted" }],
					details: { deleted: result.value },
				};
			}

			if (params.update) {
				const op = params.update;
				const normalizedTags = this.normalizeTags(op.tags);
				const result = this.getEngine().update(op.id, {
					content: op.content,
					tags: normalizedTags,
					weight: op.weight,
					expires_at: op.expires_at,
					metadata: op.metadata,
				});
				if (!result.ok) {
					return {
						content: [{ type: "text", text: `Error: ${result.error}` }],
						details: { error: result.error },
					};
				}
				if (!result.value) {
					return {
						content: [
							{
								type: "text",
								text: `Memory not found: ${op.id}\n\nTo find available memories, use: memory({ find: { query: "your search term" } })\nor\nmemory({ get: { id: "memory_id" } }) to retrieve a specific memory.`,
							},
						],
						details: { updated: false, message: "Memory not found" },
					};
				}
				return {
					content: [{ type: "text", text: "Memory updated" }],
					details: {
						updated: true,
						memory: {
							id: result.value.id,
							content: result.value.content,
							type: result.value.type,
							tags: result.value.tags,
						},
						message: "Memory updated",
					},
				};
			}

			if (params.stats) {
				const result = this.getEngine().stats();
				if (!result.ok) {
					return {
						content: [{ type: "text", text: `Error: ${result.error}` }],
						details: { error: result.error },
					};
				}
				const summary = `Memory Stats:\n- Total: ${result.value.total}\n- By type: ${JSON.stringify(
					result.value.byType,
				)}\n- By tags: ${JSON.stringify(result.value.byTags)}`;
				return {
					content: [{ type: "text", text: summary }],
					details: {
						total: result.value.total,
						byType: result.value.byType,
						byTags: result.value.byTags,
					},
				};
			}

			if (params.list) {
				const limit = params.list.limit ?? 100;
				const jsonStr = this.getEngine().exportJSON();
				let memories: any[] = [];
				try {
					memories = JSON.parse(jsonStr);
				} catch {
					memories = [];
				}
				const limitedMemories = memories.slice(0, limit);
				const summary =
					limitedMemories.length > 0
						? `Found ${memories.length} memories (showing ${limitedMemories.length}):\n${limitedMemories
								.map(
									(m) =>
										`- [${m.type}] ID: ${m.id}\n  ${m.content.substring(0, 60)}${
											m.content.length > 60 ? "..." : ""
										}\n  Tags: ${m.tags?.join(", ") || "none"}`,
								)
								.join("\n\n")}`
						: "No memories found.";
				return {
					content: [{ type: "text", text: summary }],
					details: {
						total: memories.length,
						shown: limitedMemories.length,
						memories: limitedMemories.map((m) => ({
							id: m.id,
							content: m.content,
							type: m.type,
							tags: m.tags,
							created_at: m.created_at,
						})),
					},
				};
			}

			// No operation specified
			return {
				content: [
					{
						type: "text",
						text: "Missing operation. Use nested format like: { find: { query: '...' } }, { save: { content: '...', type: 'preference' } }, { get: { id: '...' } }, { list: { limit: 10 } }, { stats: {} }",
					},
				],
				details: { error: "No operation specified" },
			};
		} catch (e) {
			const error = e as Error;
			return {
				content: [{ type: "text", text: error.message }],
				details: { error: error.message },
			};
		}
	}
}
