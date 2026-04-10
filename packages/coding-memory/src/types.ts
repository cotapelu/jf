/**
 * Coding Memory - Types for SQLite-backed memory store
 * Designed specifically for coding agents
 */

export type MemoryType = "preference" | "project" | "command" | "solution" | "note";

export interface Memory {
	id: string;
	type: MemoryType;
	content: string;
	tags: string[];
	weight: number;
	created_at: number;
	updated_at: number;
	access_count: number;
	expires_at?: number;
	metadata?: Record<string, unknown>;
}

export interface MemoryInput {
	content: string;
	type: MemoryType;
	tags?: string[];
	weight?: number;
	expires_at?: number;
	metadata?: Record<string, unknown>;
}

export interface MemoryUpdate {
	content?: string;
	tags?: string[];
	weight?: number;
	expires_at?: number;
	metadata?: Record<string, unknown>;
}

export interface MemoryQuery {
	query: string;
	type?: MemoryType;
	tags?: string[];
	limit?: number;
	minScore?: number;
}

export interface MemorySearchResult {
	memories: Memory[];
	total: number;
}

export interface MemoryStats {
	total: number;
	byType: Record<MemoryType, number>;
	byTags: Record<string, number>;
	averageWeight: number;
}

export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export interface MemoryStore {
	save(input: MemoryInput): Result<Memory>;
	find(query: string, options?: Partial<MemoryQuery>): MemorySearchResult;
	get(id: string): Result<Memory | null>;
	update(id: string, data: MemoryUpdate): Result<Memory | null>;
	delete(id: string): Result<boolean>;
	stats(): MemoryStats;
	clear(): void;
}
