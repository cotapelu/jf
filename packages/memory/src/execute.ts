/**
 * Memory Execute Operations
 * Pure functions for memory CRUD operations
 * Reused by both standalone tools and coding-agent integration
 */

import type { Memory, MemoryType } from "./types.js";

export type MemoryOperation =
	| { save: SaveInput }
	| { find: FindInput }
	| { get: GetInput }
	| { list: ListInput }
	| { forget: ForgetInput }
	| { update: UpdateInput }
	| { stats: StatsInput };

// ============================================================================
// Input Types (matching schema)
// ============================================================================

export interface SaveInput {
	content: string;
	type: MemoryType;
	tags?: string[];
	weight?: number;
	expires_at?: number;
}

export interface FindInput {
	query: string;
	type?: MemoryType;
	tags?: string[];
	limit?: number;
}

export interface GetInput {
	id: string;
}

export interface ListInput {
	limit?: number;
}

export interface ForgetInput {
	id: string;
}

export interface UpdateInput {
	id: string;
	content?: string;
	tags?: string[];
	weight?: number;
	expires_at?: number;
	metadata?: Record<string, unknown>;
}

export interface StatsInput {}

// ============================================================================
// Execution Functions
// ============================================================================

export interface ExecuteResult {
	content: string;
	details: Record<string, unknown>;
}

// Engine interface - matches what createMemoryEngine returns
interface EngineInterface {
	save(input: unknown): import("./types.js").Result<import("./types.js").Memory>;
	find(query: string, options?: unknown): import("./types.js").Result<import("./types.js").MemorySearchResult>;
	get(id: string): import("./types.js").Result<import("./types.js").Memory | null>;
	update(id: string, data: unknown): import("./types.js").Result<import("./types.js").Memory | null>;
	delete(id: string): import("./types.js").Result<boolean>;
	stats(): import("./types.js").Result<import("./types.js").MemoryStats>;
	exportJSON(): string;
}

/**
 * Execute a memory operation
 * Returns formatted result for tool output
 */
export function executeMemoryOperation(engine: EngineInterface, op: MemoryOperation): ExecuteResult {
	// Handle save operation
	if ("save" in op) {
		const input = op.save;
		const result = engine.save({
			content: input.content,
			type: input.type,
			tags: input.tags,
			weight: input.weight,
			expires_at: input.expires_at,
		});

		if (!result.ok) {
			return { content: `Error: ${result.error}`, details: { error: result.error } };
		}

		return {
			content: `Saved to ${input.type}: ${input.content.substring(0, 100)}`,
			details: { saved: { id: result.value.id, type: result.value.type } },
		};
	}

	// Handle find operation
	if ("find" in op) {
		const input = op.find;
		const result = engine.find(input.query, {
			type: input.type,
			tags: input.tags,
			limit: input.limit,
		});

		if (!result.ok) {
			return { content: `Error: ${result.error}`, details: { error: result.error } };
		}

		const searchResult = result.value;
		const summary =
			searchResult.memories.length > 0
				? `Found ${searchResult.total} memories:\n${searchResult.memories
						.map((m) => `- [${m.type}] ID: ${m.id}\n  ${m.content.substring(0, 80)}`)
						.join("\n")}`
				: `No memories found for "${input.query}"`;

		return {
			content: summary,
			details: {
				total: searchResult.total,
				memories: searchResult.memories.map((m) => ({
					id: m.id,
					content: m.content,
					type: m.type,
					tags: m.tags,
					created_at: m.created_at,
				})),
			},
		};
	}

	// Handle get operation
	if ("get" in op) {
		const input = op.get;
		const result = engine.get(input.id);

		if (!result.ok) {
			return { content: `Error: ${result.error}`, details: { error: result.error } };
		}

		if (!result.value) {
			return { content: `Memory not found: ${input.id}`, details: { message: "Memory not found" } };
		}

		const memory = result.value;
		const summary = `Memory [${memory.type}] (ID: ${memory.id}):
Content: ${memory.content}
Tags: ${memory.tags?.join(", ") || "none"}
Weight: ${memory.weight}
Created: ${new Date(memory.created_at).toISOString()}
Updated: ${new Date(memory.updated_at).toISOString()}`;

		return {
			content: summary,
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

	// Handle forget (delete) operation
	if ("forget" in op) {
		const input = op.forget;
		const result = engine.delete(input.id);

		if (!result.ok) {
			return { content: `Error: ${result.error}`, details: { error: result.error } };
		}

		if (!result.value) {
			return {
				content: `Memory not found: ${input.id}\n\nTo find available memories, use: memory({ find: { query: "your search term" } })\nor\nmemory({ stats: {} }) to see memory statistics.`,
				details: { deleted: false, message: "Memory not found" },
			};
		}

		return { content: "Memory deleted", details: { deleted: true } };
	}

	// Handle update operation
	if ("update" in op) {
		const input = op.update;
		const result = engine.update(input.id, {
			content: input.content,
			tags: input.tags,
			weight: input.weight,
			expires_at: input.expires_at,
			metadata: input.metadata,
		});

		if (!result.ok) {
			return { content: `Error: ${result.error}`, details: { error: result.error } };
		}

		if (!result.value) {
			return {
				content: `Memory not found: ${input.id}\n\nTo find available memories, use: memory({ find: { query: "your search term" } })\nor\nmemory({ get: { id: "memory_id" } }) to retrieve a specific memory.`,
				details: { updated: false, message: "Memory not found" },
			};
		}

		return {
			content: "Memory updated",
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

	// Handle stats operation
	if ("stats" in op) {
		const result = engine.stats();

		if (!result.ok) {
			return { content: `Error: ${result.error}`, details: { error: result.error } };
		}

		const summary = `Memory Stats:\n- Total: ${result.value.total}\n- By type: ${JSON.stringify(result.value.byType)}\n- By tags: ${JSON.stringify(result.value.byTags)}`;

		return {
			content: summary,
			details: {
				total: result.value.total,
				byType: result.value.byType,
				byTags: result.value.byTags,
			},
		};
	}

	// Handle list operation
	if ("list" in op) {
		const limit = op.list?.limit ?? 100;
		const jsonStr = engine.exportJSON();
		let memories: Memory[] = [];

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
								`- [${m.type}] ID: ${m.id}\n  ${m.content.substring(0, 60)}${m.content.length > 60 ? "..." : ""}\n  Tags: ${m.tags?.join(", ") || "none"}`,
						)
						.join("\n\n")}`
				: "No memories found.";

		return {
			content: summary,
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
		content:
			"Missing operation. Use nested format like: { find: { query: '...' } }, { save: { content: '...', type: 'preference' } }, { get: { id: '...' } }, { list: { limit: 10 } }, { stats: {} }",
		details: { error: "No operation specified" },
	};
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalize tags input - handles both array and JSON string
 * LLM sometimes sends tags as "['ui','theme']" instead of ['ui','theme']
 */
export function normalizeTags(tags: string[] | string | undefined): string[] | undefined {
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

/**
 * Normalize params to handle common LLM errors:
 * - Stringified JSON objects
 * - Missing required fields
 * - Wrong data types
 */
export function normalizeParams<T>(params: unknown): T {
	// If params is a string, try to parse it
	if (typeof params === "string") {
		try {
			params = JSON.parse(params);
		} catch (e) {
			throw new Error(`Invalid JSON string: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	// Ensure params is an object
	if (typeof params !== "object" || params === null) {
		throw new Error("Parameters must be an object");
	}

	const normalized = params as Record<string, unknown>;

	// Handle each nested operation being a string instead of object
	const operationKeys = ["save", "find", "get", "list", "forget", "update", "stats"];

	for (const key of operationKeys) {
		if (normalized[key] && typeof normalized[key] === "string") {
			try {
				normalized[key] = JSON.parse(normalized[key] as string);
			} catch (e) {
				throw new Error(
					`${key} must be an object, not a string. Error: ${e instanceof Error ? e.message : String(e)}`,
				);
			}
		}
	}

	return normalized as T;
}
