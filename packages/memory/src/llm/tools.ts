/**
 * LLM Interface - Tool Schema for LLM Agents
 * Defines tools that LLM can call to interact with memory system
 * LLM = PROPOSER, SYSTEM = CONTROLLER
 */

import { err, MemoryError, ok } from "../errors.js";
import type { IMemoryEngine, MemoryInput, MemoryTool, MemoryType, MemoryUpdate, Result } from "../types.js";

/**
 * Tool parameter schemas (for documentation/tool definition)
 */
export const TOOL_SCHEMAS = {
	/**
	 * Tool: create_memory
	 * LLM proposes to create a memory, system validates and executes
	 */
	create_memory: {
		name: "create_memory",
		description: "Create a new memory entry. LLM proposes, system validates and stores.",
		parameters: {
			type: "object",
			properties: {
				type: {
					type: "string",
					enum: ["short_term", "long_term", "episodic", "semantic", "working"],
					description: "Type of memory",
				},
				content: {
					type: "object",
					properties: {
						text: {
							type: "string",
							description: "Memory content text",
						},
						metadata: {
							type: "object",
							description: "Optional metadata key-value pairs",
						},
					},
					required: ["text"],
				},
				tags: {
					type: "array",
					items: { type: "string" },
					description: "Optional tags for categorization",
				},
				weight: {
					type: "number",
					minimum: 0,
					maximum: 1,
					description: "Importance weight (0-1), default 0.5",
				},
			},
			required: ["type", "content"],
		},
	},

	/**
	 * Tool: update_memory
	 * LLM proposes update, system validates and executes
	 */
	update_memory: {
		name: "update_memory",
		description: "Update an existing memory. LLM proposes, system validates and updates.",
		parameters: {
			type: "object",
			properties: {
				id: {
					type: "string",
					description: "Memory ID to update",
				},
				content: {
					type: "object",
					properties: {
						text: { type: "string" },
						metadata: { type: "object" },
					},
					description: "New content (partial update)",
				},
				tags: {
					type: "array",
					items: { type: "string" },
					description: "New tags (replaces existing)",
				},
				weight: {
					type: "number",
					minimum: 0,
					maximum: 1,
					description: "New weight",
				},
			},
			required: ["id"],
		},
	},

	/**
	 * Tool: delete_memory
	 * LLM proposes delete, system validates and executes
	 */
	delete_memory: {
		name: "delete_memory",
		description: "Delete a memory by ID. LLM proposes, system validates and deletes.",
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

	/**
	 * Tool: retrieve_memories
	 * Query memories based on a search query
	 */
	retrieve_memories: {
		name: "retrieve_memories",
		description: "Retrieve relevant memories based on a query. Returns ranked results.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Search query string",
				},
				limit: {
					type: "number",
					minimum: 1,
					maximum: 100,
					description: "Maximum number of results (default 10)",
				},
				types: {
					type: "array",
					items: {
						type: "string",
						enum: ["short_term", "long_term", "episodic", "semantic", "working"],
					},
					description: "Filter by memory types",
				},
				tags: {
					type: "array",
					items: { type: "string" },
					description: "Filter by tags (AND logic)",
				},
			},
			required: ["query"],
		},
	},

	/**
	 * Tool: search_memories
	 * Search memories by tags
	 */
	search_memories: {
		name: "search_memories",
		description: "Search memories by tags. Returns matching memories sorted by relevance.",
		parameters: {
			type: "object",
			properties: {
				tags: {
					type: "array",
					items: { type: "string" },
					description: "Tags to search for",
				},
				limit: {
					type: "number",
					minimum: 1,
					maximum: 100,
					description: "Maximum results (default 10)",
				},
			},
			required: ["tags"],
		},
	},

	/**
	 * Tool: list_memories
	 * List all memories with optional filters
	 */
	list_memories: {
		name: "list_memories",
		description: "List all memories, optionally filtered by type or tags.",
		parameters: {
			type: "object",
			properties: {
				type: {
					type: "string",
					enum: ["short_term", "long_term", "episodic", "semantic", "working"],
					description: "Filter by memory type",
				},
				tags: {
					type: "array",
					items: { type: "string" },
					description: "Filter by tags (AND logic)",
				},
				limit: {
					type: "number",
					minimum: 1,
					maximum: 100,
					description: "Maximum results (default 50)",
				},
			},
		},
	},

	/**
	 * Tool: get_memory_stats
	 * Get statistics about the memory store
	 */
	get_memory_stats: {
		name: "get_memory_stats",
		description: "Get statistics about stored memories (count by type, tags, etc.)",
		parameters: {
			type: "object",
			properties: {},
		},
	},
} as const;

/**
 * Create the LLM tool interface
 * This interface provides tools that LLM can CALL (not execute directly)
 * System validates and executes all tool calls
 */
export function createLLMToolInterface(engine: IMemoryEngine) {
	/**
	 * Get all tool definitions (for LLM system prompt)
	 */
	function getTools(): MemoryTool[] {
		return Object.values(TOOL_SCHEMAS).map((schema) => ({
			name: schema.name,
			description: schema.description,
			parameters: schema.parameters as Record<string, unknown>,
		}));
	}

	/**
	 * Execute a tool call (system controls execution, not LLM)
	 */
	async function executeTool(
		toolName: string,
		params: Record<string, unknown>,
	): Promise<Result<unknown, MemoryError>> {
		try {
			switch (toolName) {
				case "create_memory": {
					const input: MemoryInput = {
						type: params.type as MemoryInput["type"],
						content: params.content as MemoryInput["content"],
						tags: params.tags as string[],
						weight: params.weight as number | undefined,
					};
					const result = engine.createMemory(input);
					return result as Result<unknown, MemoryError>;
				}

				case "update_memory": {
					const id = params.id as string;
					const update: MemoryUpdate = {
						content: params.content as MemoryUpdate["content"],
						tags: params.tags as string[],
						weight: params.weight as number | undefined,
					};
					const result = engine.updateMemory(id, update);
					return result as Result<unknown, MemoryError>;
				}

				case "delete_memory": {
					const id = params.id as string;
					const result = engine.deleteMemory(id);
					return result as Result<unknown, MemoryError>;
				}

				case "retrieve_memories": {
					const result = engine.retrieve(params.query as string, {
						limit: params.limit as number | undefined,
						types: params.types as MemoryType[] | undefined,
						tags: params.tags as string[] | undefined,
					});
					return result as Result<unknown, MemoryError>;
				}

				case "search_memories": {
					const result = engine.searchByTags(params.tags as string[], params.limit as number | undefined);
					return result as Result<unknown, MemoryError>;
				}

				case "list_memories": {
					const filter: Record<string, unknown> = {};
					if (params.type) filter.type = params.type;
					if (params.tags) filter.tags = params.tags;
					const result = engine.listMemories(filter as any);
					return result as Result<unknown, MemoryError>;
				}

				case "get_memory_stats": {
					return ok(engine.getStats());
				}

				default:
					return err(new MemoryError(`Unknown tool: ${toolName}`, "UNKNOWN_TOOL", 400));
			}
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return err(new MemoryError(`Tool execution failed: ${error.message}`, "TOOL_ERROR", 500));
		}
	}

	/**
	 * Format tool result for LLM consumption
	 */
	function formatToolResult(result: Result<unknown, MemoryError>): string {
		if (!result.ok) {
			return JSON.stringify({
				success: false,
				error: result.error.message,
				code: result.error.code,
			});
		}

		return JSON.stringify({
			success: true,
			data: result.value,
		});
	}

	/**
	 * Get tool call examples for LLM prompt
	 */
	function getToolExamples(): string {
		return JSON.stringify(
			[
				{
					tool: "create_memory",
					example: {
						type: "long_term",
						content: { text: "User prefers dark mode interface" },
						tags: ["preference", "ui"],
						weight: 0.8,
					},
				},
				{
					tool: "retrieve_memories",
					example: {
						query: "user interface preferences",
						limit: 5,
						types: ["long_term"],
					},
				},
				{
					tool: "search_memories",
					example: {
						tags: ["preference"],
						limit: 10,
					},
				},
			],
			null,
			2,
		);
	}

	return {
		getTools,
		executeTool,
		formatToolResult,
		getToolExamples,
	};
}

/**
 * Type for tool interface
 */
export type LLMToolInterface = ReturnType<typeof createLLMToolInterface>;

/**
 * Helper to generate system prompt for LLM about memory tools
 */
export function generateMemorySystemPrompt(): string {
	const examples = JSON.stringify(
		[
			{
				tool: "create_memory",
				example: {
					type: "long_term",
					content: { text: "User prefers dark mode interface" },
					tags: ["preference", "ui"],
					weight: 0.8,
				},
			},
			{
				tool: "retrieve_memories",
				example: {
					query: "user interface preferences",
					limit: 5,
					types: ["long_term"],
				},
			},
			{
				tool: "search_memories",
				example: {
					tags: ["preference"],
					limit: 10,
				},
			},
		],
		null,
		2,
	);

	return `You have access to a Memory System for storing and retrieving information.

## Available Tools:

${Object.values(TOOL_SCHEMAS)
	.map(
		(tool) => `### ${tool.name}
${tool.description}
Parameters: ${JSON.stringify(tool.parameters, null, 2)}`,
	)
	.join("\n\n")}

## Important Rules:

1. LLM = PROPOSER, SYSTEM = CONTROLLER
   - You PROPOSE actions using tools
   - The System validates and executes
   - Always check the result of tool calls

2. Use memories to maintain context across conversations
   - Store important information with create_memory
   - Retrieve relevant info with retrieve_memories or search_memories

3. Memory Types:
   - short_term: Current conversation context
   - long_term: Persistent user preferences
   - episodic: Past conversation history
   - semantic: Knowledge and facts
   - working: Current task context

## Example Tool Usage:
${examples}`;
}
