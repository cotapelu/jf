/**
 * Memory Store Interface
 * Pluggable backend for memory storage
 */

import type { IMemoryStore, Memory, MemoryFilter, MemoryInput, MemoryUpdate } from "../types.js";

export type { IMemoryStore };

/**
 * Create an in-memory memory store
 * Simple implementation using Map for storage
 */
export function createMemoryStore(): IMemoryStore {
	const store = new Map<string, Memory>();

	function generateId(): string {
		return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
	}

	function now(): number {
		return Date.now();
	}

	return {
		create(input: MemoryInput): Memory {
			const id = generateId();
			const memory: Memory = {
				id,
				type: input.type,
				content: input.content,
				tags: input.tags ?? [],
				embedding: input.embedding,
				weight: input.weight ?? 0.5,
				accessCount: 0,
				createdAt: now(),
				updatedAt: now(),
				expiresAt: input.expiresAt,
			};
			store.set(id, memory);
			return memory;
		},

		get(id: string): Memory | null {
			const memory = store.get(id);
			if (!memory) return null;

			// Check expiration
			if (memory.expiresAt && memory.expiresAt < now()) {
				store.delete(id);
				return null;
			}

			return memory;
		},

		update(id: string, data: MemoryUpdate): Memory | null {
			const existing = store.get(id);
			if (!existing) return null;

			const updated: Memory = {
				...existing,
				content: data.content ?? existing.content,
				tags: data.tags ?? existing.tags,
				embedding: data.embedding !== undefined ? data.embedding : existing.embedding,
				weight: data.weight ?? existing.weight,
				expiresAt: data.expiresAt !== undefined ? data.expiresAt : existing.expiresAt,
				updatedAt: now(),
			};

			store.set(id, updated);
			return updated;
		},

		delete(id: string): boolean {
			return store.delete(id);
		},

		query(filter: MemoryFilter): Memory[] {
			const nowMs = now();
			const memories: Memory[] = [];

			for (const memory of store.values()) {
				// Check expiration
				if (memory.expiresAt && memory.expiresAt < nowMs) {
					store.delete(memory.id);
					continue;
				}

				// Apply filters
				if (filter.type && memory.type !== filter.type) continue;
				if (filter.tags?.length) {
					const hasAllTags = filter.tags.every((t) => memory.tags.includes(t));
					if (!hasAllTags) continue;
				}
				if (filter.createdAfter && memory.createdAt < filter.createdAfter) continue;
				if (filter.createdBefore && memory.createdAt > filter.createdBefore) continue;
				if (filter.minWeight !== undefined && memory.weight < filter.minWeight) continue;
				if (filter.hasEmbedding !== undefined) {
					const hasEmbedding = memory.embedding !== undefined;
					if (hasEmbedding !== filter.hasEmbedding) continue;
				}

				memories.push(memory);
			}

			return memories;
		},

		bulkCreate(items: MemoryInput[]): Memory[] {
			return items.map((item) => this.create(item));
		},

		count(filter?: MemoryFilter): number {
			if (!filter) return store.size;
			return this.query(filter).length;
		},

		clear(): void {
			store.clear();
		},
	};
}

/**
 * Interface for custom store implementations
 * Use this to implement Redis, Postgres, etc. backends
 */
export interface MemoryStoreAdapter {
	create(memory: Memory): Promise<Memory>;
	get(id: string): Promise<Memory | null>;
	update(id: string, data: Partial<Memory>): Promise<Memory | null>;
	delete(id: string): Promise<boolean>;
	query(filter: MemoryFilter): Promise<Memory[]>;
	bulkCreate(memories: Memory[]): Promise<Memory[]>;
	count(filter?: MemoryFilter): Promise<number>;
	clear(): Promise<void>;
}

/**
 * Adapter to wrap async store as sync (for simple use cases)
 * For production, use the async adapter directly
 */
export function adaptAsyncStore<T extends MemoryStoreAdapter>(_asyncStore: T): IMemoryStore {
	return {
		create(_input: MemoryInput): Memory {
			// Sync wrapper - for async stores use the adapter directly
			throw new Error("Use async adapter for async stores");
		},
		get(_id: string): Memory | null {
			throw new Error("Use async adapter for async stores");
		},
		update(_id: string, _data: MemoryUpdate): Memory | null {
			throw new Error("Use async adapter for async stores");
		},
		delete(_id: string): boolean {
			throw new Error("Use async adapter for async stores");
		},
		query(_filter: MemoryFilter): Memory[] {
			throw new Error("Use async adapter for async stores");
		},
		bulkCreate(_items: MemoryInput[]): Memory[] {
			throw new Error("Use async adapter for async stores");
		},
		count(_filter?: MemoryFilter): number {
			throw new Error("Use async adapter for async stores");
		},
		clear(): void {
			throw new Error("Use async adapter for async stores");
		},
	};
}
