/**
 * Context Builder for Memory
 * Builds prompt context from retrieved memories for LLM
 */

import { err, MemoryError, ok } from "../errors.js";
import { ContextOptionsSchema, validateInput } from "../schemas.js";
import type { ContextOptions, MemoryContext, MemoryType, RankedMemory } from "../types.js";

/**
 * Default context template
 */
const DEFAULT_TEMPLATE = `## Relevant Context
{{memories}}

---
Generated at: {{timestamp}}`;

/**
 * Memory entry template
 */
const _MEMORY_ENTRY_TEMPLATE = `[{{type}}] {{title}}
{{content}}
Tags: {{tags}}
Relevance: {{relevance}}%`;

/**
 * Resolve context options with defaults
 */
function resolveOptions(options?: ContextOptions) {
	return {
		limit: options?.limit ?? 5,
		types: options?.types,
		includeMetadata: options?.includeMetadata ?? false,
		template: options?.template ?? DEFAULT_TEMPLATE,
	};
}

/**
 * Format a single memory for context
 */
function formatMemoryEntry(memory: RankedMemory, includeMetadata: boolean): string {
	// Extract a title from content (first sentence or first 50 chars)
	const firstSentence = memory.memory.content.text.split(/[.!?]/)[0];
	const title = firstSentence.length > 50 ? `${firstSentence.substring(0, 50)}...` : firstSentence;

	let entry = `[${memory.memory.type.toUpperCase()}] ${title}
${memory.memory.content.text}`;

	if (includeMetadata && memory.memory.content.metadata) {
		entry += `\nMetadata: ${JSON.stringify(memory.memory.content.metadata)}`;
	}

	entry += `\nTags: ${memory.memory.tags.join(", ") || "none"}`;
	entry += `\nRelevance: ${(memory.score * 100).toFixed(0)}%`;

	return entry;
}

/**
 * Format multiple memories into a string
 */
function formatMemories(memories: RankedMemory[], includeMetadata: boolean): string {
	if (memories.length === 0) {
		return "No relevant memories found.";
	}

	const entries = memories.map((m, i) => {
		const formatted = formatMemoryEntry(m, includeMetadata);
		return `--- Memory ${i + 1} ---\n${formatted}`;
	});

	return entries.join("\n\n");
}

/**
 * Resolve which types to include
 */
function resolveTypes(types?: string[]): string[] | undefined {
	if (!types || types.length === 0) {
		return undefined; // Include all types
	}
	return types;
}

/**
 * Filter memories by allowed types
 */
function filterByTypes(memories: RankedMemory[], types?: string[]): RankedMemory[] {
	if (!types || types.length === 0) {
		return memories;
	}
	return memories.filter((m) => types.includes(m.memory.type));
}

/**
 * Build context from ranked memories
 */
export function buildContext(
	query: string,
	rankedMemories: RankedMemory[],
	options?: ContextOptions,
): { ok: true; value: MemoryContext } | { ok: false; error: MemoryError } {
	// Validate options
	if (options) {
		const validation = validateInput(ContextOptionsSchema, options, "ContextOptions");
		if (!validation.ok) {
			return err(new MemoryError(validation.error.message, "INVALID_OPTIONS", 400));
		}
	}

	const resolved = resolveOptions(options);

	// Filter by types if specified
	const filtered = filterByTypes(rankedMemories, resolveTypes(resolved.types));

	// Limit number of memories
	const limited = filtered.slice(0, resolved.limit);

	// Format memories
	const formattedMemories = formatMemories(limited, resolved.includeMetadata);

	// Apply template
	let contextText = resolved.template
		.replace("{{memories}}", formattedMemories)
		.replace("{{timestamp}}", new Date().toISOString());

	// Truncate if too long
	const maxLength = 10000; // Hard limit
	if (contextText.length > maxLength) {
		contextText = `${contextText.substring(0, maxLength)}\n\n[...truncated...]`;
	}

	return ok({
		text: contextText,
		memories: limited,
		metadata: {
			query,
			includedCount: limited.length,
			generatedAt: Date.now(),
		},
	});
}

/**
 * Build a simple context string (convenience function)
 */
export function buildSimpleContext(memories: RankedMemory[], maxMemories: number = 5): string {
	const limited = memories.slice(0, maxMemories);
	return formatMemories(limited, false);
}

/**
 * Build context for a specific memory type
 */
export function buildContextForType(
	query: string,
	rankedMemories: RankedMemory[],
	type: MemoryType,
	limit: number = 3,
): { ok: true; value: MemoryContext } | { ok: false; error: MemoryError } {
	return buildContext(query, rankedMemories, {
		limit,
		types: [type],
		includeMetadata: false,
	});
}

/**
 * Estimate token count for context (rough approximation)
 * Assumes ~4 characters per token
 */
export function estimateTokens(context: string): number {
	return Math.ceil(context.length / 4);
}

/**
 * Truncate context to fit within token limit
 */
export function truncateToTokenLimit(context: string, maxTokens: number): string {
	const maxChars = maxTokens * 4;
	if (context.length <= maxChars) {
		return context;
	}
	return `${context.substring(0, maxChars)}\n\n[...truncated to fit token limit...]`;
}

/**
 * Create a context builder with custom template
 */
export function createContextBuilder(customTemplate: string) {
	return (query: string, rankedMemories: RankedMemory[], options?: ContextOptions) => {
		return buildContext(query, rankedMemories, {
			...options,
			template: customTemplate,
		});
	};
}

/**
 * Default context template for different use cases
 */
export const CONTEXT_TEMPLATES = {
	/**
	 * Minimal context - just the facts
	 */
	minimal: `Relevant information:
{{memories}}`,

	/**
	 * Detailed context with metadata
	 */
	detailed: `## Context from Memory
{{memories}}

---
Query: {{query}}
Generated: {{timestamp}}`,

	/**
	 * Conversational context
	 */
	conversational: `Based on previous context:
{{memories}}

Use this information to inform your response.`,

	/**
	 * System prompt context
	 */
	system: `## Knowledge Base
{{memories}}

Apply this knowledge when responding.`,
};
