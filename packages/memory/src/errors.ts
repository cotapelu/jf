/**
 * Custom errors for the Memory System
 * All errors extend MemoryError base class
 */

/**
 * Base error class for memory operations
 */
export class MemoryError extends Error {
	readonly code: string;
	readonly statusCode: number;
	readonly context?: Record<string, unknown>;

	constructor(
		message: string,
		code: string = "MEMORY_ERROR",
		statusCode: number = 500,
		context?: Record<string, unknown>,
	) {
		super(message);
		this.name = "MemoryError";
		this.code = code;
		this.statusCode = statusCode;
		this.context = context;

		// Maintains proper stack trace in V8 environments
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, MemoryError);
		}
	}

	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			statusCode: this.statusCode,
			context: this.context,
			stack: this.stack,
		};
	}
}

/**
 * Error when memory not found
 */
export class MemoryNotFoundError extends MemoryError {
	constructor(id: string, operation: string = "access") {
		super(`Memory with id "${id}" not found during ${operation}`, "MEMORY_NOT_FOUND", 404, { id, operation });
		this.name = "MemoryNotFoundError";
	}
}

/**
 * Error for validation failures
 */
export class MemoryValidationError extends MemoryError {
	constructor(message: string, field?: string, value?: unknown) {
		super(`Validation failed: ${message}`, "MEMORY_VALIDATION_ERROR", 400, { field, value });
		this.name = "MemoryValidationError";
	}
}

/**
 * Error for duplicate memory
 */
export class MemoryConflictError extends MemoryError {
	constructor(reason: string, existingId?: string) {
		super(`Memory conflict: ${reason}`, "MEMORY_CONFLICT", 409, { reason, existingId });
		this.name = "MemoryConflictError";
	}
}

/**
 * Error for storage/backend failures
 */
export class MemoryStorageError extends MemoryError {
	constructor(message: string, cause?: Error) {
		super(`Storage error: ${message}`, "MEMORY_STORAGE_ERROR", 500, { cause: cause?.message });
		this.name = "MemoryStorageError";
	}
}

/**
 * Error for rate limiting
 */
export class MemoryRateLimitError extends MemoryError {
	constructor(limit: number, windowMs: number) {
		super(`Rate limit exceeded: max ${limit} operations per ${windowMs}ms`, "MEMORY_RATE_LIMIT", 429, {
			limit,
			windowMs,
		});
		this.name = "MemoryRateLimitError";
	}
}

/**
 * Error for quota exceeded
 */
export class MemoryQuotaError extends MemoryError {
	constructor(quota: string, current: number, limit: number) {
		super(`Quota exceeded: ${quota} limit (${current}/${limit})`, "MEMORY_QUOTA_EXCEEDED", 403, {
			quota,
			current,
			limit,
		});
		this.name = "MemoryQuotaError";
	}
}

/**
 * Error for invalid operation
 */
export class MemoryOperationError extends MemoryError {
	constructor(operation: string, reason: string) {
		super(`Operation "${operation}" failed: ${reason}`, "MEMORY_OPERATION_ERROR", 400, { operation, reason });
		this.name = "MemoryOperationError";
	}
}

/**
 * Result helper functions
 */
export function ok<T>(value: T): { ok: true; value: T } {
	return { ok: true, value };
}

export function err<E>(error: E): { ok: false; error: E } {
	return { ok: false, error };
}

/**
 * Match result to handle both success and error cases
 */
export function matchResult<T, E, R>(
	result: { ok: true; value: T } | { ok: false; error: E },
	onOk: (value: T) => R,
	onErr: (error: E) => R,
): R {
	return result.ok ? onOk(result.value) : onErr(result.error);
}

/**
 * Map over result (success case)
 */
export function mapResult<T, U, E>(
	result: { ok: true; value: T } | { ok: false; error: E },
	fn: (value: T) => U,
): { ok: true; value: U } | { ok: false; error: E } {
	if (result.ok) {
		return { ok: true, value: fn(result.value) };
	}
	return result;
}

/**
 * Map over result error
 */
export function mapResultError<T, E, F>(
	result: { ok: true; value: T } | { ok: false; error: E },
	fn: (error: E) => F,
): { ok: true; value: T } | { ok: false; error: F } {
	if (!result.ok) {
		return { ok: false, error: fn(result.error) };
	}
	return result;
}

/**
 * Flatten nested result
 */
export function flattenResult<T, E>(
	result: { ok: true; value: { ok: true; value: T } | { ok: false; error: E } } | { ok: false; error: E },
): { ok: true; value: T } | { ok: false; error: E } {
	if (!result.ok) {
		return result;
	}
	return result.value;
}

/**
 * Async version of matchResult
 */
export async function matchResultAsync<T, E, R>(
	result: { ok: true; value: T } | { ok: false; error: E },
	onOk: (value: T) => Promise<R>,
	onErr: (error: E) => Promise<R>,
): Promise<R> {
	return result.ok ? await onOk(result.value) : await onErr(result.error);
}
