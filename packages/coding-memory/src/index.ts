/**
 * Coding Memory - Main Export
 * SQLite-backed persistent memory for coding agents
 */

export { createCodeIndexer } from "./code-indexer.js";
export { createMemoryEngine } from "./crud.js";
export { MemoryTypeSchema, validateInput } from "./schemas.js";
export type { IMemoryStore } from "./store/memory-store.js";
export { createSQLiteStore } from "./store/sqlite-store.js";
export { createLLMToolInterface, type LLMToolInterface, TOOL_SCHEMAS } from "./tools.js";
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
