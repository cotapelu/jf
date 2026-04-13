/**
 * Coding Memory - Main Export
 * SQLite-backed persistent memory for coding agents
 */

export { createCodeIndexer } from "./code-indexer.js";
export { consolidate } from "./consolidation.js";
export { createMemoryEngine } from "./crud.js";
export { calculateHeatScore, updateAccessStats } from "./heat.js";
export { MemoryTypeSchema, validateInput } from "./schemas.js";
export type { IMemoryStore } from "./store/memory-store.js";
export { createSQLiteStore } from "./store/sqlite-store.js";
export { createLLMToolInterface, type LLMToolInterface, memoryToolDefinition, TOOL_SCHEMAS } from "./tools.js";
export type {
	Memory,
	MemoryInput,
	MemoryQuery,
	MemorySearchResult,
	MemoryStats,
	MemoryType,
	MemoryUpdate,
	Result,
} from "./types.js";
