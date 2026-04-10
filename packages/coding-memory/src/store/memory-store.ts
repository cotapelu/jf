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
	find(query: string, options?: Partial<MemoryQuery>): MemorySearchResult;
	list(options?: { limit?: number; offset?: number }): Memory[];
	get(id: string): Result<Memory | null>;
	update(id: string, data: MemoryUpdate): Result<Memory | null>;
	delete(id: string): Result<boolean>;
	stats(): MemoryStats;
	clear(): void;
}
