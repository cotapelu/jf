/**
 * Memory Tool Definition for pi coding agent
 * Uses unified schema pattern (like todo-write): one tool with op field
 */

import type { AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import type { createMemoryEngine } from "./index.js";
import type { MemoryType, Result } from "./types.js";

// =============================================================================
// Schema - Unified memory operations
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

const UpdateOp = Type.Object({
	op: Type.Literal("update"),
	id: Type.String({ description: "Memory ID to update" }),
	content: Type.Optional(Type.String({ minLength: 1, maxLength: 10000 })),
	tags: Type.Optional(Type.Array(Type.String({ maxLength: 50 }), { max: 20 })),
	weight: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
	expires_at: Type.Optional(Type.Number()),
	metadata: Type.Optional(Type.Any()),
});

const StatsOp = Type.Object({
	op: Type.Literal("stats"),
});

const memoryOpsSchema = Type.Union([SaveOp, FindOp, ForgetOp, UpdateOp, StatsOp]);

// Flat schema (direct union, not nested in object)
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
		// params is now the direct op object (save | find | forget | stats)
		const op = params;

		try {
			switch (op.op) {
				case "save": {
					const result = ctx.engine.save({
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

				case "find": {
					const result = ctx.engine.find(op.query, {
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

				case "forget": {
					const result = ctx.engine.delete(op.id);

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

				case "update": {
					const result = ctx.engine.update(op.id, {
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
				case "stats": {
					const result = ctx.engine.stats();

					if (!result.ok) {
						return { content: [{ type: "text", text: result.error }], details: { error: result.error } };
					}
					return {
						content: [{ type: "text", text: `Total: ${result.value.total} memories` }],
						details: result.value,
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
			return { content: [{ type: "text", text: error.message }], details: { error: error.message } };
		}
	},
};

// =============================================================================
// Convenience helpers (for direct use without agent integration)
// =============================================================================

export interface LLMToolInterface {
	getTools(): { name: string; description: string; parameters: any }[];
	executeTool(name: string, params: Record<string, unknown>): Promise<Result<unknown>>;
	formatToolResult(result: Result<unknown>): string;
	generateSystemPrompt(): string;
}

/**
 * Create an LLMToolInterface for direct LLM usage (non-agent context)
 */
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

User asks "What database?" → memory({ op: "find", query: "database" })

User asks to remove something → memory({ op: "forget", id: "xxx" })`;
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
