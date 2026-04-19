/**
 * Zod schemas for validation
 */

import { z } from "zod";
import type { Result } from "./types.js";

export const MemoryTypeSchema = z.enum(["preference", "project", "command", "solution", "note", "code_symbol"]);

export type MemoryTypeSchema = z.infer<typeof MemoryTypeSchema>;

export const MemoryInputSchema = z
	.object({
		content: z.string().min(1).max(10000),
		type: MemoryTypeSchema,
		tags: z.array(z.string().max(50)).max(20).optional(),
		weight: z.number().min(0).max(1).optional(),
		expires_at: z.number().int().positive().optional(),
		metadata: z.record(z.unknown()).optional(),
		// Code symbol fields (only when type === 'code_symbol')
		symbol_type: z.enum(["function", "class", "interface", "type", "enum", "module", "variable"]).optional(),
		file_path: z.string().optional(),
		line_start: z.number().int().positive().optional(),
		line_end: z.number().int().positive().optional(),
		language: z.string().optional(),
		signature: z.string().optional(),
	})
	.strict()
	.superRefine((data, ctx) => {
		// Code symbol fields only allowed when type === 'code_symbol'
		const isCodeSymbol = data.type === "code_symbol";
		const codeSymbolFields = [
			{ name: "symbol_type", val: data.symbol_type },
			{ name: "file_path", val: data.file_path },
			{ name: "line_start", val: data.line_start },
			{ name: "line_end", val: data.line_end },
			{ name: "language", val: data.language },
			{ name: "signature", val: data.signature },
		];
		for (const field of codeSymbolFields) {
			if (field.val !== undefined && !isCodeSymbol) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Field '${field.name}' is only allowed when type is 'code_symbol'`,
					path: [field.name],
				});
			}
		}
	});

export const MemoryUpdateSchema = z
	.object({
		content: z.string().min(1).max(10000).optional(),
		tags: z.array(z.string().max(50)).max(20).optional(),
		weight: z.number().min(0).max(1).optional(),
		expires_at: z.number().int().positive().optional(),
		metadata: z.record(z.unknown()).optional(),
		// Code symbol fields (allowed as optional without restriction)
		symbol_type: z.enum(["function", "class", "interface", "type", "enum", "module", "variable"]).optional(),
		file_path: z.string().optional(),
		line_start: z.number().int().positive().optional(),
		line_end: z.number().int().positive().optional(),
		language: z.string().optional(),
		signature: z.string().optional(),
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
