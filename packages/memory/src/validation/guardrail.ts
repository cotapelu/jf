/**
 * Validation Layer / Guardrail
 * Validates memory operations, prevents abuse, rate limiting
 */

import { err, type MemoryError, MemoryQuotaError, MemoryRateLimitError, MemoryValidationError, ok } from "../errors.js";
import { MemoryFilterSchema, MemoryInputSchema, MemoryUpdateSchema, validateInput } from "../schemas.js";
import type { MemoryFilter, MemoryInput, MemoryType, MemoryUpdate } from "../types.js";

/**
 * Guardrail configuration
 */
export interface GuardrailConfig {
	maxContentLength?: number; // Max characters in memory content
	maxTags?: number; // Max tags per memory
	maxTagLength?: number; // Max characters per tag
	rateLimitWindowMs?: number; // Rate limit window in ms
	rateLimitMaxOps?: number; // Max operations per window
	maxMemoriesPerType?: Partial<Record<MemoryType, number>>; // Quota per type
	enableDeduplication?: boolean; // Enable duplicate detection
	deduplicationThreshold?: number; // Similarity threshold for duplicates
}

/**
 * Default guardrail config
 */
const DEFAULT_CONFIG: GuardrailConfig = {
	maxContentLength: 10000,
	maxTags: 20,
	maxTagLength: 50,
	rateLimitWindowMs: 60000, // 1 minute
	rateLimitMaxOps: 100,
	maxMemoriesPerType: {
		short_term: 1000,
		long_term: 500,
		episodic: 2000,
		semantic: 500,
		working: 100,
	},
	enableDeduplication: true,
	deduplicationThreshold: 0.9,
};

/**
 * Rate limiter state
 */
interface RateLimitState {
	operations: number[];
	windowStart: number;
}

/**
 * Create a guardrail instance
 */
export function createGuardrail(config: GuardrailConfig = {}) {
	const cfg = { ...DEFAULT_CONFIG, ...config };

	// Rate limiting state
	const rateLimits: Map<string, RateLimitState> = new Map();

	/**
	 * Clean up old rate limit entries
	 */
	function cleanupRateLimits() {
		const now = Date.now();
		for (const [key, state] of rateLimits.entries()) {
			if (now - state.windowStart > (cfg.rateLimitWindowMs ?? 60000)) {
				rateLimits.delete(key);
			}
		}
	}

	/**
	 * Check rate limit for a key
	 */
	function checkRateLimit(key: string): { ok: true } | { ok: false; error: MemoryRateLimitError } {
		cleanupRateLimits();

		const now = Date.now();
		const windowMs = cfg.rateLimitWindowMs ?? 60000;
		const maxOps = cfg.rateLimitMaxOps ?? 100;

		const state = rateLimits.get(key);
		if (!state || now - state.windowStart > windowMs) {
			// New window
			rateLimits.set(key, { operations: [now], windowStart: now });
			return ok(true);
		}

		// Check if within limit
		const opsInWindow = state.operations.filter((t) => now - t < windowMs).length;
		if (opsInWindow >= maxOps) {
			return err(new MemoryRateLimitError(maxOps, windowMs));
		}

		// Add operation
		state.operations.push(now);
		return ok(true);
	}

	/**
	 * Validate content length
	 */
	function validateContentLength(text: string): boolean {
		const maxLength = cfg.maxContentLength ?? 10000;
		return text.length <= maxLength;
	}

	/**
	 * Validate tags
	 */
	function validateTags(tags: string[] | undefined): boolean {
		if (!tags) return true;

		if (tags.length > (cfg.maxTags ?? 20)) {
			return false;
		}

		const maxTagLength = cfg.maxTagLength ?? 50;
		for (const tag of tags) {
			if (tag.length > maxTagLength) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Check for duplicate content (simple string similarity)
	 */
	function _checkDuplication(
		newContent: string,
		existingMemories: { content: { text: string } }[],
	): { ok: true } | { ok: false; error: MemoryValidationError } {
		if (!cfg.enableDeduplication) {
			return ok(true);
		}

		const threshold = cfg.deduplicationThreshold ?? 0.9;
		const newLower = newContent.toLowerCase();

		for (const mem of existingMemories) {
			const existingLower = mem.content.text.toLowerCase();

			// Simple character-based similarity
			const similarity = calculateSimilarity(newLower, existingLower);

			if (similarity >= threshold) {
				return err(
					new MemoryValidationError(
						`Duplicate content detected (${(similarity * 100).toFixed(0)}% similar)`,
						"content",
						newContent.substring(0, 50),
					),
				);
			}
		}

		return ok(true);
	}

	/**
	 * Calculate string similarity (simple implementation)
	 */
	function calculateSimilarity(a: string, b: string): number {
		if (a === b) return 1;
		if (a.length === 0 || b.length === 0) return 0;

		// Simple overlap coefficient
		const aWords = new Set(a.split(/\s+/));
		const bWords = new Set(b.split(/\s+/));

		let intersection = 0;
		for (const word of aWords) {
			if (bWords.has(word)) intersection++;
		}

		return intersection / Math.max(aWords.size, bWords.size);
	}

	/**
	 * Validate memory input (full validation)
	 */
	function validateCreateInput(
		input: unknown,
		existingCount: number,
	): { ok: true; value: MemoryInput } | { ok: false; error: MemoryError } {
		// Schema validation
		const schemaResult = validateInput(MemoryInputSchema, input, "MemoryInput");
		if (!schemaResult.ok) {
			return err(new MemoryValidationError(schemaResult.error.message));
		}

		const memory = schemaResult.value;

		// Content length validation
		if (!validateContentLength(memory.content.text)) {
			return err(
				new MemoryValidationError(
					`Content exceeds maximum length of ${cfg.maxContentLength} characters`,
					"content",
					memory.content.text.length,
				),
			);
		}

		// Tags validation
		if (!validateTags(memory.tags)) {
			return err(
				new MemoryValidationError(
					`Tags validation failed: max ${cfg.maxTags} tags, max ${cfg.maxTagLength} chars each`,
					"tags",
					memory.tags,
				),
			);
		}

		// Rate limit check
		const rateCheck = checkRateLimit("create");
		if (!rateCheck.ok) {
			return err(rateCheck.error);
		}

		// Quota check
		const typeQuota = cfg.maxMemoriesPerType?.[memory.type];
		if (typeQuota !== undefined && existingCount >= typeQuota) {
			return err(new MemoryQuotaError(memory.type, existingCount, typeQuota));
		}

		return ok(memory);
	}

	/**
	 * Validate memory update input
	 */
	function validateUpdateInput(input: unknown): { ok: true; value: MemoryUpdate } | { ok: false; error: MemoryError } {
		// Schema validation
		const schemaResult = validateInput(MemoryUpdateSchema, input, "MemoryUpdate");
		if (!schemaResult.ok) {
			return err(new MemoryValidationError(schemaResult.error.message));
		}

		const update = schemaResult.value;

		// Content length validation (if updating content)
		if (update.content && !validateContentLength(update.content.text)) {
			return err(
				new MemoryValidationError(
					`Content exceeds maximum length of ${cfg.maxContentLength} characters`,
					"content",
					update.content.text.length,
				),
			);
		}

		// Tags validation
		if (!validateTags(update.tags)) {
			return err(new MemoryValidationError(`Tags validation failed`, "tags", update.tags));
		}

		// Rate limit check
		const rateCheck = checkRateLimit("update");
		if (!rateCheck.ok) {
			return err(rateCheck.error);
		}

		return ok(update);
	}

	/**
	 * Validate filter input
	 */
	function validateFilterInput(input: unknown): { ok: true; value: MemoryFilter } | { ok: false; error: MemoryError } {
		const schemaResult = validateInput(MemoryFilterSchema, input, "MemoryFilter");
		if (!schemaResult.ok) {
			return err(new MemoryValidationError(schemaResult.error.message));
		}
		return ok(schemaResult.value);
	}

	/**
	 * Sanitize content (basic sanitization)
	 */
	function sanitizeContent(text: string): string {
		// Remove null bytes and other control characters
		let sanitized = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

		// Trim whitespace
		sanitized = sanitized.trim();

		// Collapse multiple whitespace
		sanitized = sanitized.replace(/\s+/g, " ");

		return sanitized;
	}

	/**
	 * Get rate limit status for a key
	 */
	function getRateLimitStatus(key: string): { remaining: number; resetAt: number } {
		const now = Date.now();
		const windowMs = cfg.rateLimitWindowMs ?? 60000;
		const maxOps = cfg.rateLimitMaxOps ?? 100;

		const state = rateLimits.get(key);
		if (!state || now - state.windowStart > windowMs) {
			return { remaining: maxOps, resetAt: now + windowMs };
		}

		const opsInWindow = state.operations.filter((t) => now - t < windowMs).length;
		const remaining = Math.max(0, maxOps - opsInWindow);
		const resetAt = state.windowStart + windowMs;

		return { remaining, resetAt };
	}

	return {
		validateCreateInput,
		validateUpdateInput,
		validateFilterInput,
		sanitizeContent,
		getRateLimitStatus,
		checkRateLimit,
	};
}

/**
 * Type for guardrail return
 */
export type Guardrail = ReturnType<typeof createGuardrail>;
