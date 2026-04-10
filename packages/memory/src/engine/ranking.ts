/**
 * Ranking System for Memory
 * Advanced scoring and prioritization
 */

import type { Memory, RankedMemory } from "../types.js";

/**
 * Default ranking weights
 */
const DEFAULT_WEIGHTS = {
	recency: 0.3,
	relevance: 0.3,
	weight: 0.25,
	accessCount: 0.15,
};

/**
 * Ranking weights configuration
 */
export interface RankingWeights {
	recency: number;
	relevance: number;
	weight: number;
	accessCount: number;
}

/**
 * Options for custom ranking
 */
export interface RankingOptions {
	weights?: Partial<RankingWeights>;
	decayFunction?: "linear" | "exponential" | "logarithmic";
	maxAgeDays?: number;
}

/**
 * Calculate relevance score between query and memory
 */
export function calculateRelevance(query: string, memory: Memory): number {
	const queryLower = query.toLowerCase();
	const contentLower = memory.content.text.toLowerCase();
	const tagsLower = memory.tags.join(" ");

	// Simple word matching
	const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
	if (queryWords.length === 0) return 0;

	let contentMatches = 0;
	let tagMatches = 0;

	for (const word of queryWords) {
		if (contentLower.includes(word)) contentMatches++;
		if (tagsLower.includes(word)) tagMatches++;
	}

	const contentScore = contentMatches / queryWords.length;
	const tagScore = Math.min(1, tagMatches / queryWords.length) * 1.5; // Tags weighted higher

	return Math.min(1, (contentScore + tagScore) / 2);
}

/**
 * Calculate recency score based on age
 */
export function calculateRecency(memory: Memory, maxAgeDays: number = 30): number {
	const now = Date.now();
	const ageMs = now - Math.max(memory.createdAt, memory.updatedAt);
	const ageDays = ageMs / (1000 * 60 * 60 * 24);

	// Linear decay: 1.0 at creation, 0.0 after maxAgeDays
	return Math.max(0, 1 - ageDays / maxAgeDays);
}

/**
 * Calculate access frequency score
 */
export function calculateAccessScore(memory: Memory): number {
	// Logarithmic scaling: each additional access has diminishing returns
	// Maxes out at 10 accesses = 1.0
	return Math.min(1, Math.log10(memory.accessCount + 1) / Math.log10(11));
}

/**
 * Calculate overall ranking score
 */
export function calculateRank(
	memory: Memory,
	query: string,
	options: RankingOptions = {},
): { score: number; reasons: string[] } {
	const weights: RankingWeights = {
		recency: options.weights?.recency ?? DEFAULT_WEIGHTS.recency,
		relevance: options.weights?.relevance ?? DEFAULT_WEIGHTS.relevance,
		weight: options.weights?.weight ?? DEFAULT_WEIGHTS.weight,
		accessCount: options.weights?.accessCount ?? DEFAULT_WEIGHTS.accessCount,
	};

	const reasons: string[] = [];
	const now = Date.now();

	// Relevance score (0-1)
	const relevance = calculateRelevance(query, memory);
	const relevanceScore = relevance * weights.relevance;
	if (relevance > 0.5) {
		reasons.push(`Relevant content match (${(relevance * 100).toFixed(0)}%)`);
	}

	// Recency score (0-1)
	const recency = calculateRecency(memory, options.maxAgeDays);
	const recencyScore = recency * weights.recency;
	if (recency > 0.7) {
		const hoursAgo = Math.round((now - memory.updatedAt) / (1000 * 60 * 60));
		reasons.push(`Recent (${hoursAgo}h ago)`);
	}

	// Weight score (0-1)
	const weightScore = memory.weight * weights.weight;
	if (memory.weight > 0.8) {
		reasons.push("High importance");
	}

	// Access frequency score (0-1)
	const accessScore = calculateAccessScore(memory);
	const accessContribution = accessScore * weights.accessCount;
	if (memory.accessCount > 3) {
		reasons.push(`Frequently accessed (${memory.accessCount}x)`);
	}

	const totalScore = relevanceScore + recencyScore + weightScore + accessContribution;

	return {
		score: Math.round(totalScore * 1000) / 1000, // Round to 3 decimal places
		reasons,
	};
}

/**
 * Rank a list of memories
 */
export function rankMemories(memories: Memory[], query: string, options: RankingOptions = {}): RankedMemory[] {
	const ranked: RankedMemory[] = memories.map((memory) => {
		const { score, reasons } = calculateRank(memory, query, options);
		return { memory, score, reasons };
	});

	// Sort by score descending
	ranked.sort((a, b) => b.score - a.score);

	return ranked;
}

/**
 * Filter memories by minimum score
 */
export function filterByMinScore(ranked: RankedMemory[], minScore: number): RankedMemory[] {
	return ranked.filter((r) => r.score >= minScore);
}

/**
 * Get top N memories
 */
export function getTopN(ranked: RankedMemory[], n: number): RankedMemory[] {
	return ranked.slice(0, n);
}

/**
 * Create a ranking function with custom weights
 */
export function createRankingFunction(options: RankingOptions = {}) {
	return (memories: Memory[], query: string): RankedMemory[] => {
		return rankMemories(memories, query, options);
	};
}

/**
 * Calculate diversity score for a set of memories
 * Helps avoid returning all memories of the same type
 */
export function calculateDiversity(ranked: RankedMemory[]): number {
	if (ranked.length <= 1) return 1;

	const types = new Set<string>();
	const tags = new Set<string>();

	for (const r of ranked) {
		types.add(r.memory.type);
		for (const tag of r.memory.tags) {
			tags.add(tag);
		}
	}

	// Diversity is ratio of unique types/tags to total memories
	const typeDiversity = types.size / ranked.length;
	const tagDiversity = Math.min(1, tags.size / (ranked.length * 2)); // Assume ~2 tags per memory

	return (typeDiversity + tagDiversity) / 2;
}

/**
 * Re-rank for diversity
 * This is a simple implementation - can be enhanced with MMR (Maximal Marginal Relevance)
 */
export function rerankForDiversity(ranked: RankedMemory[], maxSameType: number = 3): RankedMemory[] {
	const result: RankedMemory[] = [];
	const typeCount: Record<string, number> = {};

	for (const r of ranked) {
		const type = r.memory.type;
		typeCount[type] = (typeCount[type] || 0) + 1;

		if (typeCount[type] <= maxSameType) {
			result.push(r);
		}
	}

	// Add remaining if we haven't filled the list
	if (result.length < ranked.length) {
		const remaining = ranked.filter((r) => !result.includes(r));
		result.push(...remaining.slice(0, ranked.length - result.length));
	}

	return result;
}
