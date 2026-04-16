/**
 * CRUD Engine for Coding Memory
 */

import { MemoryInputSchema, MemoryUpdateSchema, validateInput } from "./schemas.js";
import type { IMemoryStore } from "./store/memory-store.js";
import type { Memory, MemorySearchResult, MemoryStats, MemoryType, Result } from "./types.js";

export function createMemoryEngine(store: IMemoryStore) {
	return {
		save(input: unknown): Result<Memory> {
			const validation = validateInput(MemoryInputSchema, input, "MemoryInput");
			if (!validation.ok) {
				return { ok: false, error: validation.error };
			}

			const data = validation.value;
			return store.save({
				content: data.content,
				type: data.type,
				tags: data.tags,
				weight: data.weight,
				expires_at: data.expires_at,
				metadata: data.metadata,
			});
		},

		get(id: string): Result<Memory | null> {
			return store.get(id);
		},

		update(id: string, data: unknown): Result<Memory | null> {
			const validation = validateInput(MemoryUpdateSchema, data, "MemoryUpdate");
			if (!validation.ok) {
				return { ok: false, error: validation.error };
			}

			const updateData = validation.value;
			return store.update(id, {
				content: updateData.content,
				tags: updateData.tags,
				weight: updateData.weight,
				expires_at: updateData.expires_at,
				metadata: updateData.metadata,
			});
		},

		delete(id: string): Result<boolean> {
			return store.delete(id);
		},

		find(
			query: string,
			options?: Partial<{ type?: MemoryType; tags?: string[]; limit?: number }>,
		): Result<MemorySearchResult> {
			return store.find(query, options);
		},

		stats(): Result<MemoryStats> {
			return store.stats();
		},

		clear(): void {
			store.clear();
		},

		// Additional store methods
		expunge(olderThan?: number): Result<number> {
			return store.expunge(olderThan);
		},

		deleteByFilePath(filePath: string): Result<number> {
			return store.deleteByFilePath(filePath);
		},

		exportJSON(): string {
			return store.exportJSON();
		},

		importJSON(data: string): Result<number> {
			return store.importJSON(data);
		},

		transaction<T>(fn: (store: IMemoryStore) => T): Result<T> {
			return store.transaction(fn);
		},

		startAutoExpunge(intervalMs?: number): void {
			store.startAutoExpunge(intervalMs);
		},

		stopAutoExpunge(): void {
			store.stopAutoExpunge();
		},

		startAutoDecay(options?: { intervalMs?: number; decayAfterDays?: number; decayRate?: number }): void {
			store.startAutoDecay(options);
		},

		stopAutoDecay(): void {
			store.stopAutoDecay();
		},
	};
}
