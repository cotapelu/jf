/**
 * Retrieval Engine for Memory queries
 * Handles searching and filtering memories
 */

import { err, MemoryError, ok } from "../errors.js";
import { RetrievalOptionsSchema, validateInput } from "../schemas.js";
import type { IMemoryStore } from "../store/memory-store.js";
import type { Memory, MemoryType, RankedMemory, RetrievalOptions } from "../types.js";

/**
 * Retrieval options with defaults
 */
interface ResolvedRetrievalOptions {
	limit: number;
	types?: MemoryType[];
	tags?: string[];
	minScore?: number;
	useEmbedding: boolean;
}

/**
 * Calculate similarity between query and memory content
 * Simple keyword-based similarity for now
 */
function calculateSimilarity(query: string, memory: Memory): number {
	const queryLower = query.toLowerCase();
	const contentLower = memory.content.text.toLowerCase();

	// Split into words
	const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
	const contentWords = contentLower.split(/\s+/);

	if (queryWords.length === 0) return 0;

	// Count matching words
	let matches = 0;
	for (const qWord of queryWords) {
		if (contentWords.some((cWord) => cWord.includes(qWord))) {
			matches++;
		}
	}

	// Return normalized score
	return matches / queryWords.length;
}

/**
 * Create a retrieval engine
 */
export function createRetrievalEngine(store: IMemoryStore) {
	/**
	 * Resolve retrieval options with defaults
	 */
	function resolveOptions(options?: RetrievalOptions): ResolvedRetrievalOptions {
		return {
			limit: options?.limit ?? 10,
			types: options?.types,
			tags: options?.tags,
			minScore: options?.minScore,
			useEmbedding: options?.useEmbedding ?? false,
		};
	}

	/**
	 * Apply filters to get base set of memories
	 */
	function applyFilters(_query: string, options: ResolvedRetrievalOptions): Memory[] {
		// Get all memories - we'll filter by types in the scoring phase
		const allMemories = store.query({});

		// Filter by tags if specified
		let filtered = allMemories;
		if (options.tags?.length) {
			filtered = filtered.filter((m) => options.tags!.every((t) => m.tags.includes(t)));
		}

		// Filter by types if specified
		if (options.types?.length) {
			filtered = filtered.filter((m) => options.types!.includes(m.type));
		}

		return filtered;
	}

	/**
	 * Score memories based on relevance
	 */
	function scoreMemories(memories: Memory[], query: string): RankedMemory[] {
		const now = Date.now();
		const scored: RankedMemory[] = [];

		for (const memory of memories) {
			const reasons: string[] = [];
			let score = 0;

			// Relevance score (content similarity)
			const relevance = calculateSimilarity(query, memory);
			score += relevance * 0.4;
			if (relevance > 0.3) {
				reasons.push(`High content relevance (${(relevance * 100).toFixed(0)}%)`);
			}

			// Recency score (time since created/updated)
			const ageMs = now - Math.max(memory.createdAt, memory.updatedAt);
			const ageDays = ageMs / (1000 * 60 * 60 * 24);
			const recency = Math.max(0, 1 - ageDays / 30); // Decay over 30 days
			score += recency * 0.3;
			if (recency > 0.7) {
				reasons.push("Recent memory");
			}

			// Weight score
			score += memory.weight * 0.2;

			// Access frequency score
			const accessScore = Math.min(1, memory.accessCount / 10);
			score += accessScore * 0.1;
			if (memory.accessCount > 5) {
				reasons.push(`Frequently accessed (${memory.accessCount}x)`);
			}

			scored.push({
				memory,
				score,
				reasons,
			});
		}

		return scored;
	}

	/**
	 * Sort and limit ranked memories
	 */
	function sortAndLimit(ranked: RankedMemory[], limit: number, minScore?: number): RankedMemory[] {
		// Sort by score descending
		ranked.sort((a, b) => b.score - a.score);

		// Apply minimum score filter
		if (minScore !== undefined) {
			ranked = ranked.filter((r) => r.score >= minScore);
		}

		// Limit results
		return ranked.slice(0, limit);
	}

	/**
	 * Main retrieval function
	 * Retrieve memories matching a query
	 */
	function retrieve(
		query: string,
		options?: RetrievalOptions,
	): { ok: true; value: RankedMemory[] } | { ok: false; error: MemoryError } {
		if (!query || query.trim().length === 0) {
			return err(new MemoryError("Query cannot be empty", "INVALID_QUERY", 400));
		}

		// Validate options
		if (options) {
			const validation = validateInput(RetrievalOptionsSchema, options, "RetrievalOptions");
			if (!validation.ok) {
				return err(new MemoryError(validation.error.message, "INVALID_OPTIONS", 400));
			}
		}

		const resolved = resolveOptions(options);

		// Get base filtered memories
		const memories = applyFilters(query, resolved);

		if (memories.length === 0) {
			return ok([]);
		}

		// Score and rank
		const scored = scoreMemories(memories, query);

		// Sort and limit
		const results = sortAndLimit(scored, resolved.limit, resolved.minScore);

		return ok(results);
	}

	/**
	 * Search memories by tags
	 */
	function searchByTags(
		tags: string[],
		limit: number = 10,
	): { ok: true; value: Memory[] } | { ok: false; error: MemoryError } {
		if (!tags || tags.length === 0) {
			return err(new MemoryError("Tags cannot be empty", "INVALID_TAGS", 400));
		}

		const memories = store.query({ tags });

		// Sort by weight and recency
		const sorted = memories.sort((a: Memory, b: Memory) => {
			// Higher weight first
			if (b.weight !== a.weight) {
				return b.weight - a.weight;
			}
			// More recent first
			return b.updatedAt - a.updatedAt;
		});

		return ok(sorted.slice(0, limit));
	}

	return {
		retrieve,
		searchByTags,
	};
}
