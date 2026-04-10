/**
 * CRUD Engine for Memory operations
 * Handles create, read, update, delete operations
 */

import { err, MemoryNotFoundError, MemoryValidationError, ok } from "../errors.js";
import {
	getMemoryInputDefaults,
	MemoryFilterSchema,
	MemoryInputSchema,
	MemoryUpdateSchema,
	validateInput,
} from "../schemas.js";
import type { IMemoryStore } from "../store/memory-store.js";
import type { IMemoryEngine, Memory, MemoryEngineConfig, MemoryStats, Result } from "../types.js";

/**
 * Create a CRUD engine for memory operations
 */
export function createCRUDEngine(
	store: IMemoryStore,
	config: MemoryEngineConfig = {},
): Pick<IMemoryEngine, "createMemory" | "updateMemory" | "deleteMemory" | "getMemory" | "listMemories" | "getStats"> {
	const _defaultWeight = config.defaultWeight ?? 0.5;

	/**
	 * Create a new memory
	 */
	function createMemory(data: unknown): Result<Memory> {
		// Validate input
		const validation = validateInput(MemoryInputSchema, data, "MemoryInput");
		if (!validation.ok) {
			return err(new MemoryValidationError(validation.error.message));
		}

		const input = getMemoryInputDefaults(validation.value);

		try {
			const memory = store.create(input);
			return ok(memory);
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return err(new MemoryValidationError(error.message));
		}
	}

	/**
	 * Update an existing memory
	 */
	function updateMemory(id: string, data: unknown): Result<Memory> {
		// Validate input
		const validation = validateInput(MemoryUpdateSchema, data, "MemoryUpdate");
		if (!validation.ok) {
			return err(new MemoryValidationError(validation.error.message));
		}

		// Check if memory exists
		const existing = store.get(id);
		if (!existing) {
			return err(new MemoryNotFoundError(id, "update"));
		}

		try {
			const updated = store.update(id, validation.value);
			if (!updated) {
				return err(new MemoryNotFoundError(id, "update"));
			}
			return ok(updated);
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return err(new MemoryValidationError(error.message));
		}
	}

	/**
	 * Delete a memory by ID
	 */
	function deleteMemory(id: string): Result<boolean> {
		const existing = store.get(id);
		if (!existing) {
			return err(new MemoryNotFoundError(id, "delete"));
		}

		const deleted = store.delete(id);
		return ok(deleted);
	}

	/**
	 * Get a specific memory by ID
	 */
	function getMemory(id: string): Result<Memory | null> {
		const memory = store.get(id);
		if (memory) {
			// Increment access count
			store.update(id, { weight: memory.weight }); // This will update updatedAt
		}
		return ok(memory);
	}

	/**
	 * List memories with optional filter
	 */
	function listMemories(filter?: unknown): Result<Memory[]> {
		if (filter === undefined) {
			return ok(store.query({}));
		}

		const validation = validateInput(MemoryFilterSchema, filter, "MemoryFilter");
		if (!validation.ok) {
			return err(new MemoryValidationError(validation.error.message));
		}

		return ok(store.query(validation.value));
	}

	/**
	 * Get statistics about the memory store
	 */
	function getStats(): MemoryStats {
		const allMemories = store.query({});
		const types: Record<string, number> = {
			short_term: 0,
			long_term: 0,
			episodic: 0,
			semantic: 0,
			working: 0,
		};
		const tags: Record<string, number> = {};
		let totalWeight = 0;

		for (const memory of allMemories) {
			types[memory.type] = (types[memory.type] || 0) + 1;
			totalWeight += memory.weight;

			for (const tag of memory.tags) {
				tags[tag] = (tags[tag] || 0) + 1;
			}
		}

		return {
			totalMemories: allMemories.length,
			byType: types as Record<Memory["type"], number>,
			byTags: tags,
			averageWeight: allMemories.length > 0 ? totalWeight / allMemories.length : 0,
		};
	}

	return {
		createMemory,
		updateMemory,
		deleteMemory,
		getMemory,
		listMemories,
		getStats,
	};
}
