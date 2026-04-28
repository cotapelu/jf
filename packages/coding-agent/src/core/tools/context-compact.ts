/**
 * Context Compact Tool
 *
 * Thin wrapper around @quangtynu/pi-tools/context-compactor.
 */

import { join } from "node:path";
import type { AgentTool, AgentToolResult } from "@quangtynu/pi-agent-core";
import { Type, type Static } from "@sinclair/typebox";
import { contextCompact, type CompactResult, type CompactOptions } from "@quangtynu/pi-tools";

// =============================================================================
// Schema
// =============================================================================

const ChatMessageSchema = Type.Object({
	role: Type.Union([Type.Literal("system"), Type.Literal("user"), Type.Literal("assistant")]),
	content: Type.String(),
});

const ContextCompactSchema = Type.Object({
	type: Type.Union([Type.Literal("directory"), Type.Literal("messages")]),
	path: Type.Optional(Type.String()),
	messages: Type.Optional(Type.Array(ChatMessageSchema)),
	tokenLimit: Type.Optional(Type.Number()),
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
// Tool Class
// =============================================================================

export class ContextCompactTool implements AgentTool<typeof ContextCompactSchema, CompactResult> {
	readonly name = "context_compact";
	readonly label = "Context Compact";
	readonly description =
		"Automatically compacts code directories or chat messages to fit within token limits. Drops tests/docs/examples, removes comments, trims whitespace.";
	readonly promptSnippet = "Compact: { type: 'directory', path: './src', tokenLimit: 128000 }";
	readonly promptGuidelines = [
		"Use this tool to reduce context size before hitting token limits.",
		"Specify type: 'directory' (with path) or 'messages' (with messages array).",
		"Options: tokenLimit, dropTests, dropDocs, dropExamples, dropTypes, removeComments, trimWhitespace, useLLM, llmProvider, llmModel, maxFileTokensForHeuristic, verbose.",
		"Returns: tokensBefore, tokensAfter, tokensSaved, actions, droppedFiles/compactedFiles, etc.",
	];
	readonly parameters = ContextCompactSchema;
	readonly concurrency = "safe";
	readonly strict = true;

	constructor(private cwd: string) {}

	async execute(
		_toolCallId: string,
		params: ContextCompactParams,
		_signal?: AbortSignal,
		_onUpdate?: any,
		_context?: unknown,
	): Promise<AgentToolResult<CompactResult>> {
		try {
			// Resolve path relative to cwd if provided
			let resolvedPath: string | undefined;
			if (params.path) {
				if (params.path.startsWith("/") || /^[a-zA-Z]:\\/.test(params.path)) {
					resolvedPath = params.path;
				} else {
					resolvedPath = join(this.cwd, params.path);
				}
			}

			// Narrow and validate inputs
			let input: { type: "directory"; path: string } | { type: "messages"; messages: NonNullable<ContextCompactParams["messages"]> };
			if (params.type === "directory") {
				if (!params.path) throw new Error("path is required when type is 'directory'");
				input = { type: "directory", path: resolvedPath! };
			} else {
				if (!params.messages) throw new Error("messages is required when type is 'messages'");
				input = { type: "messages", messages: params.messages! };
			}

			// Build options (undef fields are fine)
			const options: CompactOptions = {
				tokenLimit: params.tokenLimit,
				dropTests: params.dropTests,
				dropDocs: params.dropDocs,
				dropExamples: params.dropExamples,
				dropTypes: params.dropTypes,
				removeComments: params.removeComments,
				trimWhitespace: params.trimWhitespace,
				useLLM: params.useLLM,
				llmProvider: params.llmProvider,
				llmModel: params.llmModel,
				maxFileTokensForHeuristic: params.maxFileTokensForHeuristic,
				verbose: params.verbose,
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
