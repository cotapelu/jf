/**
 * Zod schemas for validation
 */

import { z } from "zod";
import type { MemoryInput, MemoryType, MemoryUpdate, Result } from "./types.js";

export const MemoryTypeSchema = z.enum(["preference", "project", "command", "solution", "note"]);

export type MemoryTypeSchema = z.infer<typeof MemoryTypeSchema>;

export const MemoryInputSchema = z
	.object({
		content: z.string().min(1).max(10000),
		type: MemoryTypeSchema,
		tags: z.array(z.string().max(50)).max(20).optional(),
		weight: z.number().min(0).max(1).optional(),
		expires_at: z.number().int().positive().optional(),
		metadata: z.record(z.unknown()).optional(),
	})
	.strict();

export const MemoryUpdateSchema = z
	.object({
		content: z.string().min(1).max(10000).optional(),
		tags: z.array(z.string().max(50)).max(20).optional(),
		weight: z.number().min(0).max(1).optional(),
		expires_at: z.number().int().positive().optional(),
		metadata: z.record(z.unknown()).optional(),
	})
	.strict();

export const MemoryQuerySchema = z
	.object({
		query: z.string().min(1).max(500),
		type: MemoryTypeSchema.optional(),
		tags: z.array(z.string()).optional(),
		limit: z.number().int().positive().max(100).default(10),
		minScore: z.number().min(0).max(1).optional(),
	})
	.strict();

export function validateInput<T>(schema: z.ZodType<T>, data: unknown, fieldName: string = "input"): Result<T> {
	const result = schema.safeParse(data);
	if (result.success) {
		return { ok: true, value: result.data };
	}
	const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
	const message = `${fieldName} validation failed: ${issues.join(", ")}`;
	return { ok: false, error: message };
}
