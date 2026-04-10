/**
 * LLM Tool Interface for Coding Memory
 * Provides tools that LLM can call to interact with memory
 */

import type { createMemoryEngine } from "./index.js";
import type { IMemoryStore } from "./store/memory-store.js";
import type { MemoryType, Result } from "./types.js";

export interface MemoryTool {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

export interface LLMToolInterface {
	getTools(): MemoryTool[];
	executeTool(name: string, params: Record<string, unknown>): Promise<Result<unknown>>;
	formatToolResult(result: Result<unknown>): string;
	generateSystemPrompt(): string;
}

export const TOOL_SCHEMAS: Record<string, MemoryTool> = {
	memory_save: {
		name: "memory_save",
		description:
			"Save important information to memory (preferences, project facts, commands, solutions). Use this when user shares something you want to remember for future sessions.",
		parameters: {
			type: "object",
			properties: {
				content: {
					type: "string",
					description: "The information to save (max 10000 chars)",
				},
				type: {
					type: "string",
					enum: ["preference", "project", "command", "solution", "note"],
					description:
						"Type of memory: preference (user coding style), project (project-specific facts), command (workflow commands), solution (bug fixes, patterns), note (general)",
				},
				tags: {
					type: "array",
					items: { type: "string" },
					description: "Optional tags for categorization (e.g., ['python', 'testing'])",
				},
				weight: {
					type: "number",
					minimum: 0,
					maximum: 1,
					description: "Importance weight 0-1 (default 0.5). Higher = more relevant for recall",
				},
				expires_at: {
					type: "number",
					description: "Optional expiration timestamp (Unix ms). Leave empty for permanent",
				},
			},
			required: ["content", "type"],
		},
	},

	memory_find: {
		name: "memory_find",
		description:
			"Search memory for information relevant to a query. Retrieves ranked memories based on content similarity.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Search query (e.g., 'python indentation', 'database connection')",
				},
				type: {
					type: "string",
					enum: ["preference", "project", "command", "solution", "note"],
					description: "Optional filter by memory type",
				},
				tags: {
					type: "array",
					items: { type: "string" },
					description: "Optional filter by tags (AND logic)",
				},
				limit: {
					type: "number",
					minimum: 1,
					maximum: 100,
					description: "Max results (default 10)",
				},
			},
			required: ["query"],
		},
	},

	memory_forget: {
		name: "memory_forget",
		description: "Delete a memory by ID. Use when user asks to remove/forget something.",
		parameters: {
			type: "object",
			properties: {
				id: {
					type: "string",
					description: "Memory ID to delete",
				},
			},
			required: ["id"],
		},
	},

	memory_stats: {
		name: "memory_stats",
		description: "Get statistics about stored memories (count by type, tags, etc.)",
		parameters: {
			type: "object",
			properties: {},
		},
	},
};

export function createLLMToolInterface(engine: ReturnType<typeof createMemoryEngine>): LLMToolInterface {
	return {
		getTools(): MemoryTool[] {
			return Object.values(TOOL_SCHEMAS);
		},

		async executeTool(name: string, params: Record<string, unknown>): Promise<Result<unknown>> {
			try {
				switch (name) {
					case "memory_save":
						return engine.save({
							content: params.content as string,
							type: params.type as MemoryType,
							tags: params.tags as string[] | undefined,
							weight: params.weight as number | undefined,
							expires_at: params.expires_at as number | undefined,
						}) as Result<unknown>;
					case "memory_find":
						return engine.find(params.query as string, {
							type: params.type as MemoryType | undefined,
							tags: params.tags as string[] | undefined,
							limit: params.limit as number | undefined,
						}) as Result<unknown>;
					case "memory_forget":
						return engine.delete(params.id as string) as Result<unknown>;
					case "memory_stats":
						return engine.stats() as Result<unknown>;
					default:
						return { ok: false, error: `Unknown tool: ${name}` };
				}
			} catch (e) {
				const error = e as Error;
				return { ok: false, error: error.message };
			}
		},

		formatToolResult(result: Result<unknown>): string {
			if (!result.ok) {
				return JSON.stringify({ success: false, error: result.error });
			}
			// Remove sensitive metadata for LLM
			const value = JSON.parse(JSON.stringify(result.value));
			if (value.memories) {
				for (const mem of value.memories as any[]) {
					delete mem.metadata;
				}
			}
			return JSON.stringify({ success: true, data: value });
		},

		generateSystemPrompt(): string {
			return `You have access to a Memory system for storing and retrieving information across sessions.

## Available Tools:

### memory_save
Save important information. Use for:
- User preferences (indentation, language, framework)
- Project facts (database, API URLs, deployment)
- Commands (test, build, deploy workflows)
- Solutions (bug fixes, patterns)
- Notes (general)

Example: User says "I use 4 spaces" → call memory_save(type="preference", content="4 spaces for indentation", tags=["style"])

### memory_find
Search saved memories. Use when:
- You need to recall something from previous sessions
- User asks about their preferences or project setup
- You're unsure about something you've seen before

Example: User asks "What database do we use?" → call memory_find(query="database")

### memory_forget
Delete a memory by ID. Use when user explicitly asks to remove/forget something.

### memory_stats
Get statistics about stored memories (for debugging).

## Important:

1. Save NEW information proactively when user shares preferences, project details, or solutions.
2. Recall information BEFORE making assumptions about user's setup.
3. Never share or log API keys or sensitive data (they should be tagged specially).
4. Memory persists across sessions - it's your long-term knowledge about this user/project.

## Memory Types:
- preference: User coding style, editor settings, language versions
- project: Project-specific facts (DB, APIs, architecture)
- command: Terminal commands, workflows, scripts
- solution: Bug fixes, code patterns, workarounds
- note: General notes, meetings, ideas`;
		},
	};
}
