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
	// Need to re-fetch after decay/deletes? For simplicity, work on original set
	const merges = await mergeDuplicates(store, allMemories, mergeSimilarityThreshold);
	report.merged = merges.length;
	for (const { deleteId } of merges) {
		store.delete(deleteId);
	}
	if (merges.length > 0) {
		report.details.push(`Merged ${merges.length} duplicate memories`);
	}

	// 4. Prune weak memories if over limit
	const currentStats = store.stats();
	if (currentStats.total > maxMemories) {
		const pruned = await pruneWeak(store, maxMemories, minHeatScore, maxPerType, batchSize);
		report.deleted += pruned;
		report.details.push(`Pruned ${pruned} weak memories (over limit)`);
	}

	// 5. Summarize old sessions (optional, not implemented yet)

	report.remaining = store.stats().total;
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

			const similarity = calculateSimilarity(mem, other);
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
	const currentStats = store.stats();
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
function calculateSimilarity(memA: Memory, memB: Memory): number {
	const tokensA = new Set(memA.content.toLowerCase().split(/\s+/));
	const tokensB = new Set(memB.content.toLowerCase().split(/\s+/));

	if (tokensA.size === 0 || tokensB.size === 0) return 0;

	const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
	const union = new Set([...tokensA, ...tokensB]);

	return intersection.size / union.size;
}
