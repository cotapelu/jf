/**
 * Memory System - Main Export
 * Memory Layer / Memory Engine for LLM Agents
 *
 * Complete memory system with:
 * - Memory Store (data layer)
 * - CRUD Engine (write operations)
 * - Retrieval Engine (read operations)
 * - Ranking System (scoring)
 * - Context Builder (LLM input)
 * - Validation Layer (guardrail)
 * - LLM Interface (tool schema)
 *
 * LLM = PROPOSER, SYSTEM = CONTROLLER
 */

import { buildContext, buildSimpleContext, CONTEXT_TEMPLATES } from "./engine/context-builder.js";
import { createCRUDEngine } from "./engine/cruder.js";
import { calculateRecency, calculateRelevance, rankMemories } from "./engine/ranking.js";
import { createRetrievalEngine } from "./engine/retrieval.js";
import {
	err,
	MemoryConflictError,
	MemoryError,
	MemoryNotFoundError,
	MemoryOperationError,
	MemoryQuotaError,
	MemoryRateLimitError,
	MemoryStorageError,
	MemoryValidationError,
	mapResult,
	mapResultError,
	matchResult,
	ok,
} from "./errors.js";
import {
	createLLMToolInterface,
	generateMemorySystemPrompt,
	type LLMToolInterface,
	TOOL_SCHEMAS,
} from "./llm/tools.js";
import {
	assertValidMemoryFilter,
	assertValidMemoryInput,
	assertValidMemoryUpdate,
	ContextOptionsSchema,
	MemoryEngineConfigSchema,
	MemoryFilterSchema,
	MemoryInputSchema,
	MemoryTypeSchema,
	MemoryUpdateSchema,
	RetrievalOptionsSchema,
	validateInput,
} from "./schemas.js";
import { createMemoryStore } from "./store/memory-store.js";
import type {
	ContextOptions,
	IMemoryEngine,
	IMemoryStore,
	Memory,
	MemoryContext,
	MemoryEngineConfig,
	MemoryFilter,
	MemoryInput,
	MemoryStats,
	MemoryTool,
	MemoryType,
	MemoryUpdate,
	RankedMemory,
	Result,
	RetrievalOptions,
} from "./types.js";
import { createGuardrail, type Guardrail, type GuardrailConfig } from "./validation/guardrail.js";

/**
 * Create a complete Memory Engine
 * This is the main entry point for the memory system
 */
export function createMemoryEngine(config: MemoryEngineConfig = {}): IMemoryEngine {
	// Create store
	const store = createMemoryStore();

	// Create components
	const cruder = createCRUDEngine(store, config);
	const retrieval = createRetrievalEngine(store);
	const guardrail = createGuardrail();

	// Wrap CRUD operations with guardrail
	const safeCreateMemory = (data: MemoryInput): Result<Memory> => {
		const existingCount = store.count({ type: data.type });
		const validation = guardrail.validateCreateInput(data, existingCount);
		if (!validation.ok) {
			return err(validation.error);
		}
		const sanitized = guardrail.sanitizeContent(data.content.text);
		return cruder.createMemory({
			...data,
			content: { ...data.content, text: sanitized },
		});
	};

	const safeUpdateMemory = (id: string, data: MemoryUpdate): Result<Memory> => {
		const validation = guardrail.validateUpdateInput(data);
		if (!validation.ok) {
			return err(validation.error);
		}
		const sanitized = data.content
			? { ...data.content, text: guardrail.sanitizeContent(data.content.text) }
			: undefined;
		return cruder.updateMemory(id, sanitized ? { ...data, content: sanitized } : data);
	};

	// Compose the engine
	const engine: IMemoryEngine = {
		createMemory: safeCreateMemory,
		updateMemory: safeUpdateMemory,
		deleteMemory: cruder.deleteMemory,
		getMemory: cruder.getMemory,

		retrieve(query: string, options?: RetrievalOptions): Result<RankedMemory[]> {
			return retrieval.retrieve(query, options);
		},

		buildContext(query: string, options?: ContextOptions): Result<MemoryContext> {
			// First retrieve memories
			const retrieveResult = this.retrieve(query, {
				limit: options?.limit ?? 10,
				types: options?.types,
			});

			if (!retrieveResult.ok) {
				return err(retrieveResult.error);
			}

			// Build context from retrieved memories
			return buildContext(query, retrieveResult.value, options);
		},

		searchByTags(tags: string[], limit?: number): Result<Memory[]> {
			return retrieval.searchByTags(tags, limit);
		},

		listMemories(filter?: MemoryFilter): Result<Memory[]> {
			return cruder.listMemories(filter);
		},

		getStats(): MemoryStats {
			return cruder.getStats();
		},
	};

	return engine;
}

/**
 * Quick factory for creating a memory engine with default config
 */
export function createDefaultMemoryEngine(): IMemoryEngine {
	return createMemoryEngine({});
}

// Re-export everything
export {
	assertValidMemoryFilter,
	assertValidMemoryInput,
	assertValidMemoryUpdate,
	buildContext,
	buildSimpleContext,
	CONTEXT_TEMPLATES,
	type ContextOptions,
	ContextOptionsSchema,
	calculateRecency,
	calculateRelevance,
	// Engine components
	createCRUDEngine,
	// Guardrail
	createGuardrail,
	// LLM Interface
	createLLMToolInterface,
	// Store
	createMemoryStore,
	createRetrievalEngine,
	err,
	type Guardrail,
	type GuardrailConfig,
	generateMemorySystemPrompt,
	type IMemoryEngine,
	type IMemoryStore,
	type LLMToolInterface,
	// Types
	type Memory,
	MemoryConflictError,
	type MemoryContext,
	type MemoryEngineConfig,
	MemoryEngineConfigSchema,
	// Errors
	MemoryError,
	type MemoryFilter,
	MemoryFilterSchema,
	type MemoryInput,
	MemoryInputSchema,
	MemoryNotFoundError,
	MemoryOperationError,
	MemoryQuotaError,
	MemoryRateLimitError,
	type MemoryStats,
	MemoryStorageError,
	type MemoryTool,
	type MemoryType,
	// Schemas
	MemoryTypeSchema,
	type MemoryUpdate,
	MemoryUpdateSchema,
	MemoryValidationError,
	mapResult,
	mapResultError,
	matchResult,
	ok,
	type RankedMemory,
	type Result,
	type RetrievalOptions,
	RetrievalOptionsSchema,
	rankMemories,
	TOOL_SCHEMAS,
	validateInput,
};

// Also export as default for convenience
export default createMemoryEngine;
