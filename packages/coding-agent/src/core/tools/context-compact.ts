/**
 * Context Compact Tool
 *
 * Thin wrapper around @quangtynu/pi-tools/context-compactor.
 */

import { join } from "node:path";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { type CompactOptions, type CompactResult, contextCompact } from "@quangtynu/pi-tools";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";

// =============================================================================
// Schema
// =============================================================================

const ChatMessageSchema = Type.Object({
	role: Type.Union([Type.Literal("system"), Type.Literal("user"), Type.Literal("assistant")]),
	content: Type.String(),
});

const ContextCompactSchema = Type.Object({
	// type và messages không cần thiết nếu tool được bind với session (auto-get messages)
	// nhưng giữ lại để backward compatibility
	type: Type.Optional(Type.Union([Type.Literal("directory"), Type.Literal("messages")])),
	path: Type.Optional(Type.String()),
	messages: Type.Optional(Type.Array(ChatMessageSchema)),
	tokenLimit: Type.Optional(
		Type.Number({ minimum: 1, description: "Target token limit after compaction (default: 128000)" }),
	),
	dropTests: Type.Optional(Type.Boolean()),
	dropDocs: Type.Optional(Type.Boolean()),
	dropExamples: Type.Optional(Type.Boolean()),
	dropTypes: Type.Optional(Type.Boolean()),
	removeComments: Type.Optional(Type.Boolean()),
	trimWhitespace: Type.Optional(Type.Boolean()),
	useLLM: Type.Optional(Type.Boolean()),
	llmProvider: Type.Optional(Type.Union([Type.Literal("openai"), Type.Literal("anthropic")])),
	llmModel: Type.Optional(Type.String()),
	maxFileTokensForHeuristic: Type.Optional(Type.Number()),
	verbose: Type.Optional(Type.Boolean()),
});

type ContextCompactParams = Static<typeof ContextCompactSchema>;

// =============================================================================
// Tool Definition & Factory
// =============================================================================

/** Create a ToolDefinition for context_compact */
export function createContextCompactToolDefinition(
	cwd: string,
	_options?: Record<string, never>,
): ToolDefinition<typeof ContextCompactSchema, CompactResult> {
	return {
		name: "context_compact",
		label: "Context Compact",
		description:
			"Compacts chat message history to fit within token limits before calling LLM. Preserves important messages.",
		promptSnippet: "Compact context: { tokenLimit: 128000 }",
		promptGuidelines: [
			"Use this tool to compact conversation history when approaching token limits.",
			"When bound to a session, automatically uses current conversation messages.",
			"Set tokenLimit (default 128000). Other options: removeComments, trimWhitespace, etc.",
			"Returns: tokensBefore, tokensAfter, tokensSaved, and compactedMessages.",
		],
		parameters: ContextCompactSchema,
		async execute(
			toolCallId: string,
			params: ContextCompactParams,
			signal?: AbortSignal,
			onUpdate?: any,
			_ctx?: unknown,
		): Promise<AgentToolResult<CompactResult>> {
			const tool = new ContextCompactTool(cwd);
			return tool.execute(toolCallId, params, signal, onUpdate, _ctx);
		},
	};
}

// =============================================================================
// Tool Instance Factory
// =============================================================================

/** Create a ContextCompactTool instance for the given cwd */
export function createContextCompactTool(cwd: string): ContextCompactTool {
	return new ContextCompactTool(cwd);
}

// =============================================================================
// Tool Class
// ===============================================================================

export class ContextCompactTool implements AgentTool<typeof ContextCompactSchema, CompactResult> {
	readonly name = "context_compact";
	readonly label = "Context Compact";
	readonly description =
		"Compacts chat message history to fit within token limits before calling LLM. Preserves important messages.";
	readonly promptSnippet = "Compact context: { tokenLimit: 128000 }";
	readonly promptGuidelines = [
		"Use this tool to compact conversation history when approaching token limits.",
		"When bound to a session, automatically uses current conversation messages.",
		"Set tokenLimit (default 128000). Other options: removeComments, trimWhitespace, etc.",
		"Returns: tokensBefore, tokensAfter, tokensSaved, and compactedMessages.",
	];
	readonly parameters = ContextCompactSchema;
	readonly concurrency = "safe";
	readonly strict = true;
	prepareArguments = (args: unknown): ContextCompactParams => args as ContextCompactParams;

	constructor(
		private cwd: string,
		private session?: any,
	) {}

	async execute(
		_toolCallId: string,
		params: unknown,
		_signal?: AbortSignal,
		_onUpdate?: any,
		_context?: unknown,
	): Promise<AgentToolResult<CompactResult>> {
		const validatedParams = this.prepareArguments?.(params) ?? (params as ContextCompactParams);
		try {
			// Resolve path relative to cwd if provided
			let _resolvedPath: string | undefined;
			if (validatedParams.path) {
				if (validatedParams.path.startsWith("/") || /^[a-zA-Z]:\\/.test(validatedParams.path)) {
					_resolvedPath = validatedParams.path;
				} else {
					_resolvedPath = join(this.cwd, validatedParams.path);
				}
			}
			let messagesForCompact: NonNullable<ContextCompactParams["messages"]>;
			if (this.session?.agent?.state) {
				// Auto-bind: use current conversation messages from agent state
				const agentMsgs = this.session.agent.state.messages;
				messagesForCompact = agentMsgs.map((m: any) => ({
					role:
						m.role === "toolResult"
							? "user"
							: ((m.role === "system" ? "system" : m.role) as "system" | "user" | "assistant"),
					content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
				}));
			} else if (validatedParams.messages) {
				messagesForCompact = validatedParams.messages;
			} else {
				throw new Error("No messages: bind tool to session or provide messages param");
			}

			// Only messages type supported (directory deprecated)
			if (validatedParams.type === "directory") {
				throw new Error("Directory compaction not supported; use messages only");
			}
			const input = { type: "messages" as const, messages: messagesForCompact };

			// Build options
			const options: CompactOptions = {
				tokenLimit: validatedParams.tokenLimit,
				dropTests: validatedParams.dropTests,
				dropDocs: validatedParams.dropDocs,
				dropExamples: validatedParams.dropExamples,
				dropTypes: validatedParams.dropTypes,
				removeComments: validatedParams.removeComments,
				trimWhitespace: validatedParams.trimWhitespace,
				useLLM: validatedParams.useLLM,
				llmProvider: validatedParams.llmProvider,
				llmModel: validatedParams.llmModel,
				maxFileTokensForHeuristic: validatedParams.maxFileTokensForHeuristic,
				verbose: validatedParams.verbose,
			};

			const result = await contextCompact(input, options);

			const message = `✅ Compacted: ${result.tokensBefore}→${result.tokensAfter} tokens (saved ${result.tokensSaved})`;
			return {
				content: [{ type: "text", text: message }],
				details: result,
			};
		} catch (error: any) {
			// Return a valid CompactResult with error field
			const emptyResult: CompactResult = {
				tokensBefore: 0,
				tokensAfter: 0,
				tokensSaved: 0,
				wasCompacted: false,
				actions: [],
				error: error.message,
			};
			return {
				content: [{ type: "text", text: `❌ Error: ${error.message}` }],
				details: emptyResult,
			};
		}
	}
}

// Pre-built definitions (avoid TDZ by placing after class)
export const contextCompactTool = createContextCompactTool(process.cwd());
export const contextCompactToolDefinition = createContextCompactToolDefinition(process.cwd());
