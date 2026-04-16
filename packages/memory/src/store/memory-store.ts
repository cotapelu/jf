/**
 * Memory Store Interface
 */

import type {
	Memory,
	MemoryInput,
	MemoryQuery,
	MemorySearchResult,
	MemoryStats,
	MemoryUpdate,
	Result,
} from "../types.js";

export interface IMemoryStore {
	save(input: MemoryInput): Result<Memory>;
	find(query: string, options?: Partial<MemoryQuery>): Result<MemorySearchResult>;
	list(options?: { limit?: number; offset?: number }): Memory[];
	get(id: string): Result<Memory | null>;
	update(id: string, data: MemoryUpdate): Result<Memory | null>;
	delete(id: string): Result<boolean>;
	stats(): Result<MemoryStats>;
	clear(): void;
	expunge(olderThan?: number): Result<number>;
	deleteByFilePath(filePath: string): Result<number>;
	/** Export all memories as JSON */
	exportJSON(): string;
	/** Import memories from JSON, returns number imported */
	importJSON(data: string): Result<number>;
	/** Execute operations atomically in a transaction */
	transaction<T>(fn: (store: IMemoryStore) => T): Result<T>;
	/** Start automatic cleanup of expired memories (default: every 24h) */
	startAutoExpunge(intervalMs?: number): void;
	/** Stop automatic cleanup */
	stopAutoExpunge(): void;
	/** Start automatic weight decay for unused memories */
	startAutoDecay(options?: { intervalMs?: number; decayAfterDays?: number; decayRate?: number }): void;
	/** Stop automatic weight decay */
	stopAutoDecay(): void;
}
