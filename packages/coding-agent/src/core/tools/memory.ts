/**
 * Memory Tool for pi coding agent
 * Stores and retrieves persistent information across sessions
 *
 * Reuses execute logic from @quangtynu/pi-coding-memory
 */

import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/pi-agent-core";
import type { MemoryType } from "@quangtynu/pi-coding-memory";
import {
	createMemoryEngine,
	createSQLiteStore,
	executeMemoryOperation,
	normalizeParams,
	normalizeTags,
} from "@quangtynu/pi-coding-memory";
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
// Schema - Nested memory operations
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
		"Store/retrieve: { find: { query:'dark' } }, save:{ content:'x', type:'preference' }, get:{ id:'x' }, list:{ limit:5 }";
	readonly promptGuidelines = [
		"IMPORTANT: All parameters must be OBJECTS, not strings. Do not JSON.stringify any values.",
		"Nested format: { op: { params } } e.g., { find: { query: 'dark' } }, { save: { content: 'x', type: 'preference' } }",
		"Ops: save(content, type[preference|project|command|solution|note], tags?, weight?), find(query, type?, tags?, limit?), get(id), list(limit?), stats(), forget(id), update(id, content?)",
		"Types: preference (user style), project (facts), command (workflows), solution (bug fixes), note (general)",
		"Search memory before assuming user setup. Never save API keys.",
		"Examples:",
		"  - Save: { save: { content: 'User prefers dark mode', type: 'preference', tags: ['ui', 'theme'] } }",
		"  - Find: { find: { query: 'dark mode', type: 'preference' } }",
		"  - Get: { get: { id: 'mem-123' } }",
		"  - Update: { update: { id: 'mem-123', content: 'Updated content' } }",
		"  - Forget: { forget: { id: 'mem-123' } }",
		"  - List: { list: { limit: 10 } }",
		"  - Stats: { stats: {} }",
	];
	readonly parameters = memorySchema;
	readonly concurrency = "parallel";
	readonly strict = true;
	prepareArguments = (args: unknown): MemoryParams => normalizeParams(args as MemoryParams);

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

	async execute(
		_toolCallId: string,
		params: MemoryParams,
		_signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<MemoryToolDetails>,
		_context?: unknown,
	): Promise<AgentToolResult<MemoryToolDetails>> {
		const validatedParams = params;
		const engine = this.getEngine();

		try {
			// Route to reusable execute function
			if (validatedParams.save) {
				const result = executeMemoryOperation(engine, {
					save: {
						content: validatedParams.save.content,
						type: validatedParams.save.type as MemoryType,
						tags: normalizeTags(validatedParams.save.tags),
						weight: validatedParams.save.weight,
						expires_at: validatedParams.save.expires_at,
					},
				});
				return { content: [{ type: "text", text: result.content }], details: result.details as MemoryToolDetails };
			}

			if (validatedParams.find) {
				const result = executeMemoryOperation(engine, {
					find: {
						query: validatedParams.find.query,
						type: validatedParams.find.type as MemoryType | undefined,
						tags: normalizeTags(validatedParams.find.tags),
						limit: validatedParams.find.limit,
					},
				});
				return { content: [{ type: "text", text: result.content }], details: result.details as MemoryToolDetails };
			}

			if (validatedParams.get) {
				const result = executeMemoryOperation(engine, { get: { id: validatedParams.get.id } });
				return { content: [{ type: "text", text: result.content }], details: result.details as MemoryToolDetails };
			}

			if (validatedParams.list) {
				const result = executeMemoryOperation(engine, { list: { limit: validatedParams.list.limit } });
				return { content: [{ type: "text", text: result.content }], details: result.details as MemoryToolDetails };
			}

			if (validatedParams.forget) {
				const result = executeMemoryOperation(engine, { forget: { id: validatedParams.forget.id } });
				return { content: [{ type: "text", text: result.content }], details: result.details as MemoryToolDetails };
			}

			if (validatedParams.update) {
				const result = executeMemoryOperation(engine, {
					update: {
						id: validatedParams.update.id,
						content: validatedParams.update.content,
						tags: normalizeTags(validatedParams.update.tags as string[] | string | undefined),
						weight: validatedParams.update.weight,
						expires_at: validatedParams.update.expires_at,
						metadata: validatedParams.update.metadata,
					},
				});
				return { content: [{ type: "text", text: result.content }], details: result.details as MemoryToolDetails };
			}

			if (validatedParams.stats) {
				const result = executeMemoryOperation(engine, { stats: {} });
				return { content: [{ type: "text", text: result.content }], details: result.details as MemoryToolDetails };
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
