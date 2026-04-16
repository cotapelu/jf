/**
 * Memory Consolidation
 * Auto-evolution: decay unused, merge duplicates, prune weak
 */

import { calculateHeatScore } from "./heat.js";
import type { IMemoryStore } from "./store/memory-store.js";
import type { Memory } from "./types.js";

export interface ConsolidationOptions {
	/** Days of inactivity before decay starts (default: 30) */
	decayAfterDays?: number;
	/** Daily decay rate for unused memories (default: 0.01 = 1%) */
	decayRate?: number;
	/** Similarity threshold for merging (0-1, default: 0.85) */
	mergeSimilarityThreshold?: number;
	/** Maximum total memories before pruning (default: 10000) */
	maxMemories?: number;
	/** Minimum heat score before pruning (default: 0.01) */
	minHeatScore?: number;
	/** Max memories per type (optional) */
	maxPerType?: Record<string, number>;
	/** Pagination limit when fetching all memories (default: 1000) */
	batchSize?: number;
	/** Similarity algorithm: 'jaccard' (fast token overlap) or 'cosine-tfidf' (weighted) */
	similarityAlgorithm?: "jaccard" | "cosine-tfidf";
}

export interface ConsolidationReport {
	deleted: number;
	merged: number;
	decayed: number;
	remaining: number;
	details: string[];
}

/**
 * Main consolidation orchestrator
 */
export async function consolidate(
	store: IMemoryStore,
	options: ConsolidationOptions = {},
): Promise<ConsolidationReport> {
	const {
		decayAfterDays = 30,
		decayRate = 0.01,
		mergeSimilarityThreshold = 0.85,
		maxMemories = 10000,
		minHeatScore = 0.01,
		maxPerType = {},
		batchSize = 1000,
		similarityAlgorithm = "jaccard",
	} = options;

	const report: ConsolidationReport = {
		deleted: 0,
		merged: 0,
		decayed: 0,
		remaining: 0,
		details: [],
	};

	// 1. Get all memories (paginated)
	const allMemories = await fetchAllMemories(store, batchSize);
	report.remaining = allMemories.length;
	if (allMemories.length === 0) {
		return report;
	}

	// 2. Decay unused memories
	const decayedIds = decayUnused(store, allMemories, decayAfterDays, decayRate);
	report.decayed = decayedIds.length;
	for (const id of decayedIds) {
		store.delete(id);
	}
	if (decayedIds.length > 0) {
		report.details.push(`Decayed ${decayedIds.length} unused memories`);
	}

	// 3. Merge duplicates
	// Precompute vectors if using cosine-tfidf
	const vectors = similarityAlgorithm === "cosine-tfidf" ? precomputeTFIDFVectors(allMemories) : undefined;

	const merges = await mergeDuplicates(store, allMemories, mergeSimilarityThreshold, {
		algorithm: similarityAlgorithm,
		vectors,
	});
	report.merged = merges.length;
	for (const { deleteId } of merges) {
		store.delete(deleteId);
	}
	if (merges.length > 0) {
		report.details.push(`Merged ${merges.length} duplicate memories`);
	}

	// 4. Prune weak memories if over limit
	const statsResult = store.stats();
	if (!statsResult.ok) {
		throw new Error(statsResult.error);
	}
	const currentStats = statsResult.value;
	if (currentStats.total > maxMemories) {
		const pruned = await pruneWeak(store, maxMemories, minHeatScore, maxPerType, batchSize);
		report.deleted += pruned;
		report.details.push(`Pruned ${pruned} weak memories (over limit)`);
	}

	// 5. Summarize old sessions (optional, not implemented yet)

	const finalStatsResult = store.stats();
	report.remaining = finalStatsResult.ok ? finalStatsResult.value.total : 0;
	return report;
}

/**
 * Fetch all memories with pagination
 */
async function fetchAllMemories(store: IMemoryStore, batchSize: number): Promise<Memory[]> {
	const all: Memory[] = [];
	let offset = 0;

	while (true) {
		const batch = store.list({ limit: batchSize, offset });
		if (batch.length === 0) break;
		all.push(...batch);
		if (batch.length < batchSize) break;
		offset += batchSize;
	}

	return all;
}

/**
 * Decay memories that haven't been accessed recently
 * Returns IDs of memories that should be deleted (weight too low)
 */
function decayUnused(store: IMemoryStore, memories: Memory[], decayAfterDays: number, decayRate: number): string[] {
	const now = Date.now();
	const cutoff = now - decayAfterDays * 24 * 60 * 60 * 1000;
	const toDelete: string[] = [];

	for (const mem of memories) {
		// Skip if accessed recently (updated_at includes weight updates, but that's okay)
		if (mem.updated_at > cutoff) continue;

		const daysInactive = (now - mem.updated_at) / (24 * 60 * 60 * 1000);
		const decayFactor = (1 - decayRate) ** daysInactive;
		const newWeight = mem.weight * decayFactor;

		if (newWeight < 0.01) {
			toDelete.push(mem.id);
		} else if (Math.abs(newWeight - mem.weight) > 0.001) {
			// Update weight only if changed significantly
			store.update(mem.id, { weight: newWeight });
		}
	}

	return toDelete;
}

/**
 * Merge similar memories based on content similarity
 * Returns array of { keepId, deleteId } pairs
 */
async function mergeDuplicates(
	store: IMemoryStore,
	memories: Memory[],
	threshold: number,
	opts?: { algorithm?: "jaccard" | "cosine-tfidf"; vectors?: Map<string, Vector> },
): Promise<{ deleteId: string }[]> {
	const groups: Memory[][] = [];
	const used = new Set<string>();

	// Sort by weight descending so stronger ones are considered first
	const sorted = [...memories].sort((a, b) => b.weight - a.weight);

	for (let i = 0; i < sorted.length; i++) {
		const mem = sorted[i];
		if (used.has(mem.id)) continue;

		const group: Memory[] = [mem];
		used.add(mem.id);

		for (let j = i + 1; j < sorted.length; j++) {
			const other = sorted[j];
			if (used.has(other.id)) continue;
			if (other.type !== mem.type) continue;

			// Compute similarity based on algorithm
			const similarity: number =
				opts?.algorithm === "cosine-tfidf" && opts.vectors
					? (() => {
							const vecA = opts.vectors!.get(mem.id);
							const vecB = opts.vectors!.get(other.id);
							return vecA && vecB ? cosineSimilarity(vecA, vecB) : 0;
						})()
					: calculateJaccardSimilarity(mem, other);

			if (similarity >= threshold) {
				group.push(other);
				used.add(other.id);
			}
		}

		if (group.length > 1) {
			groups.push(group);
		}
	}

	const merges: { deleteId: string }[] = [];

	for (const group of groups) {
		// Already sorted by weight descending
		const primary = group[0];
		const duplicates = group.slice(1);

		// Merge tags from duplicates into primary
		const tagSet = new Set([...primary.tags]);
		for (const dup of duplicates) {
			for (const tag of dup.tags) {
				tagSet.add(tag);
			}
		}
		const mergedTags = Array.from(tagSet);

		// Update primary with merged tags
		store.update(primary.id, { tags: mergedTags });

		// Mark duplicates for deletion
		for (const dup of duplicates) {
			merges.push({ deleteId: dup.id });
		}
	}

	return merges;
}

/**
 * Prune weakest memories to stay under max limit
 */
async function pruneWeak(
	store: IMemoryStore,
	maxMemories: number,
	minHeatScore: number,
	maxPerType: Record<string, number>,
	batchSize: number,
): Promise<number> {
	const statsResult = store.stats();
	if (!statsResult.ok) {
		throw new Error(statsResult.error);
	}
	const currentStats = statsResult.value;
	const overAll = currentStats.total - maxMemories;
	if (overAll <= 0) return 0;

	// Fetch all memories with heat scores
	const all = await fetchAllMemories(store, batchSize);

	// Calculate heat for each
	const withHeat = all.map((mem) => ({
		mem,
		heat: calculateHeatScore(mem.weight, mem.access_count, mem.updated_at),
	}));

	// Sort by heat ascending (weakest first)
	withHeat.sort((a, b) => a.heat - b.heat);

	// Determine how many to delete
	const toDelete: string[] = [];
	let deleted = 0;

	for (const { mem, heat } of withHeat) {
		if (deleted >= overAll) break;
		if (heat < minHeatScore) {
			toDelete.push(mem.id);
			deleted++;
		}
	}

	// Also respect per-type limits if specified
	for (const [type, limit] of Object.entries(maxPerType)) {
		const typeMemories = all.filter((m) => m.type === type);
		if (typeMemories.length <= limit) continue;

		// Sort by heat ascending
		const typeWithHeat = typeMemories
			.map((mem) => ({
				mem,
				heat: calculateHeatScore(mem.weight, mem.access_count, mem.updated_at),
			}))
			.sort((a, b) => a.heat - b.heat);

		const overType = typeMemories.length - limit;
		let deletedType = 0;
		for (const { mem, heat } of typeWithHeat) {
			if (deletedType >= overType) break;
			if (!toDelete.includes(mem.id) && heat < minHeatScore) {
				toDelete.push(mem.id);
				deletedType++;
				deleted++;
			}
		}
	}

	// Delete all marked
	for (const id of toDelete) {
		store.delete(id);
	}

	return deleted;
}

/**
 * Optional: Summarize old chat sessions
 */
export async function summarizeOldSessions(_store: IMemoryStore, _olderThanDays: number = 30): Promise<void> {
	// TODO: Implement with LLM summarization
	// - Find all "note" type with "chat" tag older than X days
	// - Group by session (maybe by tag)
	// - Call LLM to summarize
	// - Create new memory with summary, delete old ones
}

/**
 * Simple Jaccard similarity on token sets
 */
interface Vector extends Map<string, number> {}

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter((s) => s.length > 0);
}

function precomputeTFIDFVectors(memories: Memory[]): Map<string, Vector> {
	const N = memories.length;
	const df = new Map<string, number>();

	// Compute document frequency
	for (const mem of memories) {
		const tokens = new Set(tokenize(mem.content));
		for (const token of tokens) {
			df.set(token, (df.get(token) || 0) + 1);
		}
	}

	// Compute IDF
	const idf = new Map<string, number>();
	for (const [token, count] of df) {
		idf.set(token, Math.log(N / count));
	}

	// Compute TF-IDF vectors
	const vectors = new Map<string, Vector>();
	for (const mem of memories) {
		const tokens = tokenize(mem.content);
		const total = tokens.length || 1;
		const tf = new Map<string, number>();
		for (const token of tokens) {
			tf.set(token, (tf.get(token) || 0) + 1);
		}

		const vec: Vector = new Map();
		for (const [token, freq] of tf) {
			const idf_val = idf.get(token) || 0;
			vec.set(token, (freq / total) * idf_val);
		}
		vectors.set(mem.id, vec);
	}

	return vectors;
}

function cosineSimilarity(a: Vector, b: Vector): number {
	let dot = 0;
	let normA = 0;
	for (const [token, val] of a) {
		const valB = b.get(token) || 0;
		dot += val * valB;
		normA += val * val;
	}
	let normB = 0;
	for (const val of b.values()) {
		normB += val * val;
	}
	if (normA === 0 || normB === 0) return 0;
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function calculateJaccardSimilarity(memA: Memory, memB: Memory): number {
	const tokensA = new Set(memA.content.toLowerCase().split(/\s+/));
	const tokensB = new Set(memB.content.toLowerCase().split(/\s+/));

	if (tokensA.size === 0 || tokensB.size === 0) return 0;

	const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
	const union = new Set([...tokensA, ...tokensB]);

	return intersection.size / union.size;
}
