/**
 * Memory Tool Definition for pi coding agent
 * Uses nested schema format (like memory tool in coding-agent)
 */

import type { AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import type { createMemoryEngine } from "./index.js";
import type { MemoryType, Result } from "./types.js";

// =============================================================================
// Schemas (unchanged)
// =============================================================================

const SaveOp = Type.Object({
	content: Type.String({ description: "The information to save (max 10000 chars)" }),
	type: Type.Union(
		[
			Type.Literal("preference"),
			Type.Literal("project"),
			Type.Literal("command"),
			Type.Literal("solution"),
			Type.Literal("note"),
		],
		{ description: "Type of memory" },
	),
	tags: Type.Optional(Type.Array(Type.String(), { description: "Optional tags" })),
	weight: Type.Optional(Type.Number({ minimum: 0, maximum: 1, description: "Importance 0-1, default 0.5" })),
	expires_at: Type.Optional(Type.Number({ description: "Optional expiration timestamp (Unix ms)" })),
});

const FindOp = Type.Object({
	query: Type.String({ description: "Search query" }),
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
	tags: Type.Optional(Type.Array(Type.String(), { description: "Filter by tags (AND)" })),
	limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, description: "Max results, default 10" })),
});

const GetOp = Type.Object({
	id: Type.String({ description: "Memory ID to retrieve" }),
});

const ForgetOp = Type.Object({
	id: Type.String({ description: "Memory ID to delete" }),
});

const UpdateOp = Type.Object({
	id: Type.String({ description: "Memory ID to update" }),
	content: Type.Optional(Type.String({ minLength: 1, maxLength: 10000 })),
	tags: Type.Optional(Type.Array(Type.String({ maxLength: 50 }), { max: 20 })),
	weight: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
	expires_at: Type.Optional(Type.Number()),
	metadata: Type.Optional(Type.Any()),
});

const ListOp = Type.Object({
	limit: Type.Optional(Type.Number({ minimum: 1, maximum: 1000, description: "Max memories, default 100" })),
});

const StatsOp = Type.Object({});

const memoryOpsSchema = Type.Object({
	save: Type.Optional(SaveOp),
	find: Type.Optional(FindOp),
	get: Type.Optional(GetOp),
	list: Type.Optional(ListOp),
	forget: Type.Optional(ForgetOp),
	update: Type.Optional(UpdateOp),
	stats: Type.Optional(StatsOp),
});

export const memorySchema = memoryOpsSchema;

type MemoryParams = Static<typeof memorySchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const memoryToolDefinition = {
	name: "memory",
	label: "Memory",
	description:
		"Store and retrieve persistent information across sessions. Use to remember user preferences, project facts, commands, and solutions.",
	promptSnippet: "memory: store and retrieve persistent info",
	parameters: memorySchema,

	async execute(
		_toolCallId: string,
		params: MemoryParams,
		_signal: AbortSignal | undefined,
		_onUpdate: AgentToolUpdateCallback<any> | undefined,
		ctx: { engine: ReturnType<typeof createMemoryEngine> },
	): Promise<AgentToolResult<any>> {
		try {
			return await executeMemoryTool(params, ctx.engine);
		} catch (e) {
			const error = e as Error;
			return { content: [{ type: "text", text: error.message }], details: { error: error.message } };
		}
	},
};

// =============================================================================
// Execution Delegation (split handlers)
// =============================================================================

async function executeMemoryTool(
	params: MemoryParams,
	engine: ReturnType<typeof createMemoryEngine>,
): Promise<AgentToolResult<any>> {
	if (params.save) return handleSave(engine, params.save);
	if (params.find) return handleFind(engine, params.find);
	if (params.get) return handleGet(engine, params.get);
	if (params.list) return handleList(engine, params.list);
	if (params.forget) return handleForget(engine, params.forget);
	if (params.update) return handleUpdate(engine, params.update);
	if (params.stats) return handleStats(engine);

	return {
		content: [
			{
				type: "text",
				text: "Missing operation. Use nested format like: { find: { query: '...' } }, { save: { content: '...', type: 'preference' } }",
			},
		],
		details: { error: "No operation specified" },
	};
}

async function handleSave(
	engine: ReturnType<typeof createMemoryEngine>,
	op: Static<typeof SaveOp>,
): Promise<AgentToolResult<any>> {
	const result = engine.save({
		content: op.content,
		type: op.type as MemoryType,
		tags: op.tags,
		weight: op.weight,
		expires_at: op.expires_at,
	});

	if (!result.ok) {
		return { content: [{ type: "text", text: result.error }], details: { error: result.error } };
	}

	return {
		content: [{ type: "text", text: `Saved to ${op.type}: ${op.content.substring(0, 100)}` }],
		details: {
			id: result.value.id,
			type: result.value.type,
			message: `Saved to ${op.type}`,
		},
	};
}

async function handleFind(
	engine: ReturnType<typeof createMemoryEngine>,
	op: Static<typeof FindOp>,
): Promise<AgentToolResult<any>> {
	const result = engine.find(op.query, {
		type: op.type as MemoryType | undefined,
		tags: op.tags,
		limit: op.limit,
	});

	if (!result.ok) {
		return { content: [{ type: "text", text: result.error }], details: { error: result.error } };
	}

	return {
		content: [{ type: "text", text: `Found ${result.value.total} memories` }],
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

async function handleGet(
	engine: ReturnType<typeof createMemoryEngine>,
	op: Static<typeof GetOp>,
): Promise<AgentToolResult<any>> {
	const result = engine.get(op.id);
	if (!result.ok) {
		return { content: [{ type: "text", text: result.error }], details: { error: result.error } };
	}
	if (!result.value) {
		return {
			content: [{ type: "text", text: `Memory not found: ${op.id}` }],
			details: { message: "Memory not found" },
		};
	}
	const memory = result.value;
	return {
		content: [
			{
				type: "text",
				text: `Memory [${memory.type}] (ID: ${memory.id}):\nContent: ${memory.content}\nTags: ${memory.tags?.join(", ") || "none"}`,
			},
		],
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

async function handleList(
	engine: ReturnType<typeof createMemoryEngine>,
	op: Static<typeof ListOp>,
): Promise<AgentToolResult<any>> {
	const limit = op.limit ?? 100;
	const jsonStr = engine.exportJSON();
	let memories: any[] = [];
	try {
		memories = JSON.parse(jsonStr);
	} catch {
		memories = [];
	}
	const limitedMemories = memories.slice(0, limit);
	return {
		content: [
			{
				type: "text",
				text: `Found ${memories.length} memories (showing ${limitedMemories.length})`,
			},
		],
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

async function handleForget(
	engine: ReturnType<typeof createMemoryEngine>,
	op: Static<typeof ForgetOp>,
): Promise<AgentToolResult<any>> {
	const result = engine.delete(op.id);
	if (!result.ok) {
		return { content: [{ type: "text", text: result.error }], details: { error: result.error } };
	}
	return {
		content: [{ type: "text", text: result.value ? "Memory deleted" : "Memory not found" }],
		details: {
			deleted: result.value,
			message: result.value ? "Memory deleted" : "Memory not found",
		},
	};
}

async function handleUpdate(
	engine: ReturnType<typeof createMemoryEngine>,
	op: Static<typeof UpdateOp>,
): Promise<AgentToolResult<any>> {
	const result = engine.update(op.id, {
		content: op.content,
		tags: op.tags,
		weight: op.weight,
		expires_at: op.expires_at,
		metadata: op.metadata,
	});

	if (!result.ok) {
		return { content: [{ type: "text", text: result.error }], details: { error: result.error } };
	}
	if (!result.value) {
		return {
			content: [{ type: "text", text: "Memory not found" }],
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

async function handleStats(engine: ReturnType<typeof createMemoryEngine>): Promise<AgentToolResult<any>> {
	const result = engine.stats();
	if (!result.ok) {
		return { content: [{ type: "text", text: result.error }], details: { error: result.error } };
	}
	return {
		content: [{ type: "text", text: `Total: ${result.value.total} memories` }],
		details: result.value,
	};
}

// =============================================================================
// LLM Tool Interface (unchanged)
// =============================================================================

export interface LLMToolInterface {
	getTools(): { name: string; description: string; parameters: any }[];
	executeTool(name: string, params: Record<string, unknown>): Promise<Result<unknown>>;
	formatToolResult(result: Result<unknown>): string;
	generateSystemPrompt(): string;
}

export function createLLMToolInterface(engine: ReturnType<typeof createMemoryEngine>): LLMToolInterface {
	const toolDef = memoryToolDefinition;

	return {
		getTools(): { name: string; description: string; parameters: any }[] {
			return [
				{
					name: toolDef.name,
					description: toolDef.description,
					parameters: toolDef.parameters,
				},
			];
		},

		async executeTool(name: string, params: Record<string, unknown>): Promise<Result<unknown>> {
			if (name !== "memory") {
				return { ok: false, error: `Unknown tool: ${name}` };
			}

			const op = (params.op as Record<string, unknown>)?.op as string;
			if (!op) {
				return { ok: false, error: "Missing op field" };
			}

			try {
				switch (op) {
					case "save": {
						const p = params.op as Record<string, unknown>;
						return engine.save({
							content: p.content as string,
							type: p.type as MemoryType,
							tags: p.tags as string[] | undefined,
							weight: p.weight as number | undefined,
							expires_at: p.expires_at as number | undefined,
						});
					}
					case "find": {
						const p = params.op as Record<string, unknown>;
						return engine.find(p.query as string, {
							type: p.type as MemoryType | undefined,
							tags: p.tags as string[] | undefined,
							limit: p.limit as number | undefined,
						});
					}
					case "forget": {
						const p = params.op as Record<string, unknown>;
						return engine.delete(p.id as string);
					}
					case "update": {
						const p = params.op as Record<string, unknown>;
						return engine.update(p.id as string, {
							content: p.content as string | undefined,
							tags: p.tags as string[] | undefined,
							weight: p.weight as number | undefined,
							expires_at: p.expires_at as number | undefined,
							metadata: p.metadata as Record<string, unknown> | undefined,
						});
					}
					case "stats": {
						return engine.stats();
					}
					default:
						return { ok: false, error: `Unknown op: ${op}` };
				}
			} catch (e) {
				return { ok: false, error: (e as Error).message };
			}
		},

		formatToolResult(result: Result<unknown>): string {
			if (!result.ok) {
				return JSON.stringify({ success: false, error: result.error });
			}
			return JSON.stringify({ success: true, data: result.value });
		},

		generateSystemPrompt(): string {
			return `## memory

Store and retrieve persistent information across sessions.

### Operations

**save** - Save important information
- content: What to remember (string)
- type: preference | project | command | solution | note
- tags: Optional categorization array
- weight: Importance 0-1, default 0.5

**find** - Search memory
- query: Search string
- type: Optional filter by memory type
- tags: Optional filter by tags (AND)
- limit: Max results, default 10

**forget** - Delete a memory
- id: Memory ID to delete

**stats** - Get memory statistics (no params)

### Usage Examples

User says "I use 4 spaces" → memory({ op: "save", content: "4 spaces for indentation", type: "preference", tags: ["style"] })

User asks "What database?" → memory({ op: "find", query: "database" })`;
		},
	};
}

// Keep old exports for backward compatibility
export const TOOL_SCHEMAS: Record<string, any> = {
	memory: {
		name: "memory",
		description: memoryToolDefinition.description,
		parameters: memorySchema,
	},
};
