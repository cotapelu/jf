/**
 * Zod schemas for validation
 * All memory inputs are validated before processing
 */

import { z } from "zod";

/**
 * Memory type enum
 */
export const MemoryTypeSchema = z.enum(["short_term", "long_term", "episodic", "semantic", "working"]);

export type MemoryTypeSchema = z.infer<typeof MemoryTypeSchema>;

/**
 * Memory content schema
 */
export const MemoryContentSchema = z.object({
	text: z
		.string()
		.min(1, "Memory content text is required")
		.max(10000, "Memory content text must be less than 10000 characters"),
	metadata: z.record(z.unknown()).optional(),
});

/**
 * Memory input schema for creating new memories
 */
export const MemoryInputSchema = z
	.object({
		type: MemoryTypeSchema,
		content: MemoryContentSchema,
		tags: z.array(z.string().max(50, "Tag must be less than 50 chars")).max(20, "Max 20 tags").optional(),
		embedding: z.array(z.number()).max(4096, "Embedding too large").optional(),
		weight: z.number().min(0).max(1).optional(),
		expiresAt: z.number().int().positive().optional(),
	})
	.strict();

export type MemoryInputSchema = z.infer<typeof MemoryInputSchema>;

/**
 * Memory input with defaults applied (for internal use)
 */
export interface MemoryInputWithDefaults extends Omit<MemoryInputSchema, "tags" | "weight"> {
	tags: string[];
	weight: number;
}

/**
 * Helper to get input with defaults applied
 */
export function getMemoryInputDefaults(input: MemoryInputSchema): MemoryInputWithDefaults {
	return {
		...input,
		tags: input.tags ?? [],
		weight: input.weight ?? 0.5,
	};
}

/**
 * Memory update schema for partial updates
 */
export const MemoryUpdateSchema = z
	.object({
		content: MemoryContentSchema.optional(),
		tags: z.array(z.string().max(50)).max(20).optional(),
		embedding: z.array(z.number()).max(4096).optional(),
		weight: z.number().min(0).max(1).optional(),
		expiresAt: z.number().int().positive().optional(),
	})
	.strict();

export type MemoryUpdateSchema = z.infer<typeof MemoryUpdateSchema>;

/**
 * Memory filter schema for querying
 */
export const MemoryFilterSchema = z
	.object({
		type: MemoryTypeSchema.optional(),
		tags: z.array(z.string()).optional(),
		createdAfter: z.number().int().positive().optional(),
		createdBefore: z.number().int().positive().optional(),
		minWeight: z.number().min(0).max(1).optional(),
		hasEmbedding: z.boolean().optional(),
	})
	.strict();

export type MemoryFilterSchema = z.infer<typeof MemoryFilterSchema>;

/**
 * Retrieval options schema
 */
export const RetrievalOptionsSchema = z
	.object({
		limit: z.number().int().positive().max(100).default(10),
		types: z.array(MemoryTypeSchema).optional(),
		tags: z.array(z.string()).optional(),
		minScore: z.number().min(0).max(1).optional(),
		useEmbedding: z.boolean().default(false),
	})
	.strict();

export type RetrievalOptionsSchema = z.infer<typeof RetrievalOptionsSchema>;

/**
 * Context options schema
 */
export const ContextOptionsSchema = z
	.object({
		limit: z.number().int().positive().max(50).default(5),
		types: z.array(MemoryTypeSchema).optional(),
		includeMetadata: z.boolean().default(false),
		template: z.string().max(500).optional(),
	})
	.strict();

export type ContextOptionsSchema = z.infer<typeof ContextOptionsSchema>;

/**
 * Memory engine config schema
 */
export const MemoryEngineConfigSchema = z
	.object({
		defaultLimit: z.number().int().positive().max(100).default(10),
		defaultWeight: z.number().min(0).max(1).default(0.5),
		rankingWeights: z
			.object({
				recency: z.number().min(0).max(1).default(0.3),
				relevance: z.number().min(0).max(1).default(0.3),
				weight: z.number().min(0).max(1).default(0.25),
				accessCount: z.number().min(0).max(1).default(0.15),
			})
			.default({}),
		contextConfig: z
			.object({
				maxLength: z.number().int().positive().max(10000).default(4000),
				defaultTemplate: z.string().max(1000).optional(),
			})
			.default({}),
	})
	.strict();

export type MemoryEngineConfigSchema = z.infer<typeof MemoryEngineConfigSchema>;

/**
 * Helper to validate and return typed result
 */
export function validateInput<T>(
	schema: z.ZodType<T>,
	data: unknown,
	fieldName: string = "input",
): { ok: true; value: T } | { ok: false; error: Error } {
	const result = schema.safeParse(data);
	if (result.success) {
		return { ok: true, value: result.data };
	}
	const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
	return { ok: false, error: new Error(`${fieldName} validation failed: ${issues.join(", ")}`) };
}

/**
 * Validate memory input, throw on invalid
 */
export function assertValidMemoryInput(data: unknown): MemoryInputSchema {
	const result = validateInput(MemoryInputSchema, data, "MemoryInput");
	if (!result.ok) {
		throw result.error;
	}
	return result.value;
}

/**
 * Validate memory update, throw on invalid
 */
export function assertValidMemoryUpdate(data: unknown): MemoryUpdateSchema {
	const result = validateInput(MemoryUpdateSchema, data, "MemoryUpdate");
	if (!result.ok) {
		throw result.error;
	}
	return result.value;
}

/**
 * Validate memory filter, throw on invalid
 */
export function assertValidMemoryFilter(data: unknown): MemoryFilterSchema {
	const result = validateInput(MemoryFilterSchema, data, "MemoryFilter");
	if (!result.ok) {
		throw result.error;
	}
	return result.value;
}
