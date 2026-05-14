/**
 * Memory Consolidation
 * Auto-evolution: decay unused, merge duplicates, prune weak
 */

import { calculateHeatScore } from "./heat.js";
import type { IMemoryStore } from "./store/memory-store.js";
import type { Memory } from "./types.js";

export interface ConsolidationOptions {
	decayAfterDays?: number;
	decayRate?: number;
	mergeSimilarityThreshold?: number;
	maxMemories?: number;
	minHeatScore?: number;
	maxPerType?: Record<string, number>;
	batchSize?: number;
	similarityAlgorithm?: "jaccard" | "cosine-tfidf";
}

export interface ConsolidationReport {
	deleted: number;
	merged: number;
	decayed: number;
	remaining: number;
	details: string[];
}

const DEFAULTS = {
	decayAfterDays: 30,
	decayRate: 0.01,
	mergeSimilarityThreshold: 0.85,
	maxMemories: 10000,
	minHeatScore: 0.01,
	batchSize: 1000,
	similarityAlgorithm: "jaccard" as const,
	maxPerType: {} as Record<string, number>,
};

export async function consolidate(
	store: IMemoryStore,
	options: ConsolidationOptions = {},
): Promise<ConsolidationReport> {
	const opts = { ...DEFAULTS, ...options };

	const all = await fetchAllMemories(store, opts.batchSize);
	if (all.length === 0) return emptyReport();

	const decayedIds = await decayOldMemories(store, all, opts.decayAfterDays, opts.decayRate);
	await deleteMemories(store, decayedIds);

	const merges = await mergeDuplicates(store, all, opts.mergeSimilarityThreshold, opts.similarityAlgorithm);
	await deleteMemories(
		store,
		merges.map((m) => m.deleteId),
	);

	const pruned = await pruneIfNeeded(store, all, opts);

	return {
		deleted: pruned,
		merged: merges.length,
		decayed: decayedIds.length,
		remaining: (await getStoreStats(store)).total,
		details: buildDetails(decayedIds, merges, pruned),
	};
}

function emptyReport(): ConsolidationReport {
	return { deleted: 0, merged: 0, decayed: 0, remaining: 0, details: [] };
}

function buildDetails(
	decayedIds: string[],
	merges: Array<{ keepId: string; deleteId: string }>,
	pruned: number,
): string[] {
	const details: string[] = [];
	if (decayedIds.length > 0) details.push(`Decayed ${decayedIds.length} unused memories`);
	if (merges.length > 0) details.push(`Merged ${merges.length} duplicate memories`);
	if (pruned > 0) details.push(`Pruned ${pruned} weak memories (over limit)`);
	return details;
}

// =============================================================================
// Decay
// =============================================================================

async function decayOldMemories(
	store: IMemoryStore,
	memories: Memory[],
	decayAfterDays: number,
	decayRate: number,
): Promise<string[]> {
	const cutoff = Date.now() - decayAfterDays * 24 * 60 * 60 * 1000;
	const toDelete: string[] = [];

	for (const mem of memories) {
		if (mem.updated_at > cutoff) continue;
		const days = (Date.now() - mem.updated_at) / (24 * 60 * 60 * 1000);
		const factor = (1 - decayRate) ** days;
		const newWeight = mem.weight * factor;

		if (newWeight < 0.01) {
			toDelete.push(mem.id);
		} else if (Math.abs(newWeight - mem.weight) > 0.001) {
			store.update(mem.id, { weight: newWeight });
		}
	}

	return toDelete;
}

// =============================================================================
// Duplicate Merging (Optimized)
// =============================================================================

interface MergeResult {
	keepId: string;
	deleteId: string;
}

async function mergeDuplicates(
	store: IMemoryStore,
	memories: Memory[],
	threshold: number,
	algorithm: "jaccard" | "cosine-tfidf",
): Promise<MergeResult[]> {
	const groups = await groupBySimilarity(memories, threshold, algorithm);
	return applyMerges(store, groups);
}

async function groupBySimilarity(
	memories: Memory[],
	threshold: number,
	algorithm: "jaccard" | "cosine-tfidf",
): Promise<Memory[][]> {
	const groups: Memory[][] = [];
	const used = new Set<string>();
	const sorted = [...memories].sort((a, b) => b.weight - a.weight);

	// Bucket by content signature to limit comparisons
	const buckets = new Map<string, Memory[]>();
	for (const mem of sorted) {
		const sig = memorySignature(mem);
		const bucket = buckets.get(sig) || [];
		bucket.push(mem);
		buckets.set(sig, bucket);
	}

	for (const bucket of buckets.values()) {
		if (bucket.length <= 1) continue;

		for (let i = 0; i < bucket.length; i++) {
			const mem = bucket[i];
			if (used.has(mem.id)) continue;

			const group: Memory[] = [mem];
			used.add(mem.id);

			for (let j = i + 1; j < bucket.length; j++) {
				const other = bucket[j];
				if (used.has(other.id) || other.type !== mem.type) continue;

				const sim = similarity(mem, other, algorithm);
				if (sim >= threshold) {
					group.push(other);
					used.add(other.id);
				}
			}

			if (group.length > 1) groups.push(group);
		}
	}

	return groups;
}

function applyMerges(store: IMemoryStore, groups: Memory[][]): MergeResult[] {
	const merges: MergeResult[] = [];

	for (const group of groups) {
		const primary = group[0];
		const duplicates = group.slice(1);

		// Merge tags
		const tagSet = new Set([...primary.tags]);
		for (const dup of duplicates) {
			for (const tag of dup.tags) tagSet.add(tag);
		}
		store.update(primary.id, { tags: Array.from(tagSet) });

		// Record deletions
		for (const dup of duplicates) {
			merges.push({ keepId: primary.id, deleteId: dup.id });
		}
	}

	return merges;
}

function memorySignature(mem: Memory): string {
	const tokens = tokenize(mem.content);
	if (tokens.length === 0) return "empty";

	const freq = new Map<string, number>();
	for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
	const top = [...freq.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map((e) => e[0])
		.sort()
		.join("|");
	return top;
}

function similarity(memA: Memory, memB: Memory, _algorithm: "jaccard" | "cosine-tfidf"): number {
	return jaccardSimilarity(memA, memB);
}

function jaccardSimilarity(memA: Memory, memB: Memory): number {
	const tokensA = new Set(memA.content.toLowerCase().split(/\s+/));
	const tokensB = new Set(memB.content.toLowerCase().split(/\s+/));
	if (tokensA.size === 0 || tokensB.size === 0) return 0;
	const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
	const union = new Set([...tokensA, ...tokensB]);
	return intersection.size / union.size;
}

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter((s) => s.length > 0);
}

// =============================================================================
// Pruning
// =============================================================================

async function pruneIfNeeded(
	store: IMemoryStore,
	all: Memory[],
	opts: {
		maxMemories: number;
		minHeatScore: number;
		maxPerType: Record<string, number>;
		batchSize: number;
	},
): Promise<number> {
	const stats = await getStoreStats(store);
	if (stats.total <= opts.maxMemories) return 0;

	const toDelete = selectMemoriesToDelete(all, opts.maxMemories, opts.minHeatScore, opts.maxPerType);
	await deleteMemories(store, toDelete);
	return toDelete.length;
}

function selectMemoriesToDelete(
	memories: Memory[],
	maxMemories: number,
	minHeat: number,
	maxPerType: Record<string, number>,
): string[] {
	const toDelete = new Set<string>();
	const overAll = memories.length - maxMemories;
	if (overAll <= 0) return [];

	const withHeat = memories.map((m) => ({
		id: m.id,
		heat: calculateHeatScore(m.weight, m.access_count, m.updated_at),
		type: m.type,
	}));

	// Global weakest
	withHeat.sort((a, b) => a.heat - b.heat);
	for (const item of withHeat) {
		if (toDelete.size >= overAll) break;
		if (item.heat < minHeat && !toDelete.has(item.id)) toDelete.add(item.id);
	}

	// Per-type limits
	for (const [type, limit] of Object.entries(maxPerType)) {
		if (limit <= 0) continue;
		const typeItems = withHeat.filter((i) => i.type === type);
		if (typeItems.length <= limit) continue;

		typeItems.sort((a, b) => a.heat - b.heat);
		const over = typeItems.length - limit;
		let deleted = 0;
		for (const item of typeItems) {
			if (deleted >= over) break;
			if (!toDelete.has(item.id) && item.heat < minHeat) {
				toDelete.add(item.id);
				deleted++;
			}
		}
	}

	return Array.from(toDelete);
}

// =============================================================================
// Helpers
// =============================================================================

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

async function deleteMemories(store: IMemoryStore, ids: string[]): Promise<void> {
	for (const id of ids) store.delete(id);
}

async function getStoreStats(store: IMemoryStore): Promise<{ total: number }> {
	const stats = store.stats();
	if (!stats.ok) throw new Error(stats.error);
	return { total: stats.value.total };
}

// Legacy exports for testing
export { fetchAllMemories as _fetchAllMemories, tokenize as _tokenize };
