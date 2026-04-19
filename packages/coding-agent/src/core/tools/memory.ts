/**
 * Memory Tool for pi coding agent
 * JSONL-style schema: each operation is a field
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
// JSONL-style Schema - each operation is a field
// =============================================================================

const memorySchema = Type.Object({
	// Save operation: content string → save as type (default: note)
	save: Type.Optional(
		Type.String({
			description: "Content to save (automatically detects type and default options)",
		}),
	),

	// Find operation: query string → search memories
	find: Type.Optional(
		Type.String({
			description: "Search query to find memories",
		}),
	),

	// Get operation: memory ID to retrieve
	get: Type.Optional(
		Type.String({
			description: "Memory ID to retrieve",
		}),
	),

	// Delete operation: memory ID to delete
	delete: Type.Optional(
		Type.String({
			description: "Memory ID to delete",
		}),
	),

	// Update operation: { id, content, ... }
	update: Type.Optional(
		Type.Object({
			id: Type.String({ description: "Memory ID to update" }),
			content: Type.Optional(Type.String({ description: "New content" })),
			tags: Type.Optional(Type.Union([Type.Array(Type.String()), Type.String()])),
			weight: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
		}),
	),

	// Stats: get memory statistics
	stats: Type.Optional(Type.Union([Type.Boolean(), Type.Object({})])),

	// List: export all memories
	list: Type.Optional(
		Type.Number({
			minimum: 1,
			maximum: 1000,
			description: "Max memories to list, default 100",
		}),
	),
});

export type MemoryParams = Static<typeof memorySchema>;

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

	// Auto-detect memory type from content
	private autoDetectType(content: string): MemoryType {
		const lower = content.toLowerCase();
		if (lower.includes("user thích") || lower.includes("prefer") || lower.includes("style")) return "preference";
		if (lower.includes("dự án") || lower.includes("project") || lower.includes("build")) return "project";
		if (lower.includes("cách chạy") || lower.includes("command") || lower.includes("run")) return "command";
		if (lower.includes("bug") || lower.includes("fix") || lower.includes("lỗi") || lower.includes("sửa"))
			return "solution";
		return "note"; // default
	}

	async execute(
		_toolCallId: string,
		params: MemoryParams,
		_signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<MemoryToolDetails>,
		_context?: unknown,
	): Promise<AgentToolResult<MemoryToolDetails>> {
		try {
			// === SAVE ===
			if (params.save !== undefined) {
				const result = this.getEngine().save({
					content: params.save,
					type: this.autoDetectType(params.save), // auto-detect type
					tags: [],
					weight: 0.5,
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
							text: `Saved: ${params.save.substring(0, 100)}`,
						},
					],
					details: {
						saved: { id: result.value.id, type: result.value.type },
					},
				};
			}

			// === FIND ===
			if (params.find !== undefined) {
				const result = this.getEngine().find(params.find, { limit: 10 });
				if (!result.ok) {
					return {
						content: [{ type: "text", text: `Error: ${result.error}` }],
						details: { error: result.error },
					};
				}
				const summary =
					result.value.memories.length > 0
						? `Found ${result.value.total} memories:\n${result.value.memories
								.map((m) => `- [${m.type}] ${m.id}: ${m.content.substring(0, 60)}`)
								.join("\n")}`
						: `No memories found for "${params.find}"`;
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

			// === GET ===
			if (params.get !== undefined) {
				const result = this.getEngine().get(params.get);
				if (!result.ok) {
					return {
						content: [{ type: "text", text: `Error: ${result.error}` }],
						details: { error: result.error },
					};
				}
				if (!result.value) {
					return {
						content: [{ type: "text", text: `Memory not found: ${params.get}` }],
						details: { message: "Memory not found" },
					};
				}
				const m = result.value;
				return {
					content: [
						{
							type: "text",
							text: `[${m.type}] ${m.id}:\n${m.content}\n\nTags: ${m.tags?.join(", ") || "none"}`,
						},
					],
					details: {
						memory: {
							id: m.id,
							content: m.content,
							type: m.type,
							tags: m.tags,
						},
					},
				};
			}

			// === DELETE ===
			if (params.delete !== undefined) {
				const result = this.getEngine().delete(params.delete);
				if (!result.ok) {
					return {
						content: [{ type: "text", text: `Error: ${result.error}` }],
						details: { error: result.error },
					};
				}
				if (!result.value) {
					return {
						content: [{ type: "text", text: `Memory not found: ${params.delete}` }],
						details: { deleted: false, message: "Memory not found" },
					};
				}
				return {
					content: [{ type: "text", text: "Memory deleted" }],
					details: { deleted: true },
				};
			}

			// === UPDATE ===
			if (params.update !== undefined) {
				const result = this.getEngine().update(params.update.id, {
					content: params.update.content,
					tags: this.normalizeTags(params.update.tags),
					weight: params.update.weight,
				});
				if (!result.ok) {
					return {
						content: [{ type: "text", text: `Error: ${result.error}` }],
						details: { error: result.error },
					};
				}
				if (!result.value) {
					return {
						content: [{ type: "text", text: `Memory not found: ${params.update.id}` }],
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
					},
				};
			}

			// === STATS ===
			if (params.stats !== undefined) {
				const result = this.getEngine().stats();
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
							text: `Total: ${result.value.total}\nBy type: ${JSON.stringify(result.value.byType)}\nBy tags: ${JSON.stringify(result.value.byTags)}`,
						},
					],
					details: {
						total: result.value.total,
						byType: result.value.byType,
						byTags: result.value.byTags,
					},
				};
			}

			// === LIST ===
			if (params.list !== undefined) {
				const jsonStr = this.getEngine().exportJSON();
				let memories: any[] = [];
				try {
					memories = JSON.parse(jsonStr);
				} catch {
					memories = [];
				}
				const limited: Array<{ id: string; content: string; type: string; tags: string[]; created_at: number }> =
					memories.slice(0, params.list);
				const summary =
					limited.length > 0
						? `${memories.length} memories (showing ${limited.length}):\n${limited
								.map((m) => `[${m.type}] ${m.id}: ${m.content.substring(0, 50)}`)
								.join("\n")}`
						: "No memories.";
				return {
					content: [{ type: "text", text: summary }],
					details: {
						total: memories.length,
						shown: limited.length,
						memories: limited.map((m) => ({
							id: m.id,
							content: m.content,
							type: m.type,
							tags: m.tags,
							created_at: m.created_at,
						})),
					},
				};
			}

			// No operation
			return {
				content: [
					{
						type: "text",
						text: 'Use: memory({ save: "content" }) or memory({ find: "query" }) or memory({ stats: true })',
					},
				],
				details: { message: "No operation specified" },
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
