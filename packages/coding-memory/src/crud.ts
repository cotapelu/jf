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
			const result = store.find(query, options);
			return { ok: true, value: result };
		},

		stats(): Result<MemoryStats> {
			return { ok: true, value: store.stats() };
		},

		clear(): void {
			store.clear();
		},
	};
}
