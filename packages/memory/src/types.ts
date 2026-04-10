/**
 * Core types for the Memory System
 * Memory Layer / Memory Engine for LLM Agents
 */

import type { z } from "zod";

/**
 * Memory types - phân loại memory theo chức năng
 */
export type MemoryType =
	| "short_term" // Chat context, ephemeral
	| "long_term" // User profile, persistent preferences
	| "episodic" // Conversation history, events
	| "semantic" // Knowledge, facts, documentation
	| "working"; // Current task context

/**
 * Memory content structure
 */
export interface MemoryContent {
	text: string;
	metadata?: Record<string, unknown>;
}

/**
 * Core Memory entity
 */
export interface Memory {
	id: string;
	type: MemoryType;
	content: MemoryContent;
	tags: string[];
	embedding?: number[]; // For semantic search (optional)
	weight: number; // Importance weight (0-1)
	accessCount: number; // Times accessed
	createdAt: number; // Unix timestamp
	updatedAt: number; // Unix timestamp
	expiresAt?: number; // Optional expiration (Unix timestamp)
}

/**
 * Input to create a new memory
 */
export interface MemoryInput {
	type: MemoryType;
	content: MemoryContent;
	tags?: string[];
	embedding?: number[];
	weight?: number;
	expiresAt?: number;
}

/**
 * Partial update for memory
 */
export interface MemoryUpdate {
	content?: MemoryContent;
	tags?: string[];
	embedding?: number[];
	weight?: number;
	expiresAt?: number;
}

/**
 * Filter for querying memories
 */
export interface MemoryFilter {
	type?: MemoryType;
	tags?: string[];
	createdAfter?: number;
	createdBefore?: number;
	minWeight?: number;
	hasEmbedding?: boolean;
}

/**
 * Options for retrieval
 */
export interface RetrievalOptions {
	limit?: number; // Max memories to return (default: 10)
	types?: MemoryType[]; // Filter by types
	tags?: string[]; // Filter by tags (AND logic)
	minScore?: number; // Minimum relevance score
	useEmbedding?: boolean; // Use semantic search (if embeddings available)
}

/**
 * Options for context building
 */
export interface ContextOptions {
	limit?: number; // Max memories to include (default: 5)
	types?: MemoryType[]; // Which types to include
	includeMetadata?: boolean; // Include metadata in context
	template?: string; // Custom template (uses {{content}}, {{type}}, {{tags}})
}

/**
 * Ranking result with score
 */
export interface RankedMemory {
	memory: Memory;
	score: number;
	reasons: string[]; // Why this memory was ranked high
}

/**
 * Context output from builder
 */
export interface MemoryContext {
	text: string;
	memories: RankedMemory[];
	metadata: {
		query: string;
		includedCount: number;
		generatedAt: number;
	};
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Tool definition for LLM interface
 */
export interface MemoryTool {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

/**
 * Memory store interface - pluggable backend
 */
export interface IMemoryStore {
	create(memory: MemoryInput): Memory;
	get(id: string): Memory | null;
	update(id: string, data: MemoryUpdate): Memory | null;
	delete(id: string): boolean;
	query(filter: MemoryFilter): Memory[];
	bulkCreate(items: MemoryInput[]): Memory[];
	count(filter?: MemoryFilter): number;
	clear(): void;
}

/**
 * Memory engine interface - core operations
 */
export interface IMemoryEngine {
	createMemory(data: MemoryInput): Result<Memory>;
	updateMemory(id: string, data: MemoryUpdate): Result<Memory>;
	deleteMemory(id: string): Result<boolean>;
	getMemory(id: string): Result<Memory | null>;
	retrieve(query: string, options?: RetrievalOptions): Result<RankedMemory[]>;
	buildContext(query: string, options?: ContextOptions): Result<MemoryContext>;
	searchByTags(tags: string[], limit?: number): Result<Memory[]>;
	listMemories(filter?: MemoryFilter): Result<Memory[]>;
	getStats(): MemoryStats;
}

/**
 * Statistics about the memory store
 */
export interface MemoryStats {
	totalMemories: number;
	byType: Record<MemoryType, number>;
	byTags: Record<string, number>;
	averageWeight: number;
}

/**
 * Configuration for MemoryEngine
 */
export interface MemoryEngineConfig {
	defaultLimit?: number;
	defaultWeight?: number;
	rankingWeights?: {
		recency?: number;
		relevance?: number;
		weight?: number;
		accessCount?: number;
	};
	contextConfig?: {
		maxLength?: number;
		defaultTemplate?: string;
	};
}

/**
 * Tool execution result from LLM interface
 */
export interface ToolExecutionResult {
	toolName: string;
	params: Record<string, unknown>;
	result: Result<unknown>;
	executedAt: number;
}

/**
 * Zod schema type (re-exported for convenience)
 */
export type ZodSchema<T> = z.ZodType<T>;
