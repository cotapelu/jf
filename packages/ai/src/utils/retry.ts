/**
 * Retry utility with exponential backoff for API calls
 * Provides a standardized way to handle retries across all providers
 */

export interface RetryOptions {
	/** Maximum number of retry attempts */
	maxRetries: number;
	/** Base delay in milliseconds */
	baseDelayMs: number;
	/** Maximum delay in milliseconds */
	maxDelayMs: number;
	/** Backoff multiplier */
	backoffMultiplier: number;
	/** Whether to add jitter to delays */
	jitter: boolean;
	/** Custom retryable error checker */
	isRetryable?: (error: unknown) => boolean;
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
	maxRetries: 3,
	baseDelayMs: 1000,
	maxDelayMs: 10000,
	backoffMultiplier: 2,
	jitter: true,
};

/**
 * Default retryable status codes
 */
export const DEFAULT_RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Default retryable error patterns
 */
export const DEFAULT_RETRYABLE_ERROR_PATTERNS = [
	/rate.?limit/i,
	/overloaded/i,
	/service.?unavailable/i,
	/upstream.?connect/i,
	/connection.?refused/i,
	/etimedout/i,
	/econnreset/i,
];

/**
 * Check if an error is retryable based on HTTP status or error message
 */
export function isRetryableError(
	error: unknown,
	options?: {
		retryableStatusCodes?: Set<number>;
		retryablePatterns?: RegExp[];
	},
): boolean {
	const retryableStatusCodes = options?.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES;
	const retryablePatterns = options?.retryablePatterns ?? DEFAULT_RETRYABLE_ERROR_PATTERNS;

	// Check for response error with status code
	if (typeof error === "object" && error !== null) {
		const err = error as Record<string, unknown>;

		// Check status code
		if (typeof err.status === "number" && retryableStatusCodes.has(err.status)) {
			return true;
		}

		// Check for statusText or message
		const errorText = String(err.statusText ?? err.message ?? "");
		for (const pattern of retryablePatterns) {
			if (pattern.test(errorText)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Calculate the delay with exponential backoff and optional jitter
 */
export function calculateDelay(attempt: number, options: RetryOptions): number {
	// Exponential backoff: baseDelay * (backoffMultiplier ^ attempt)
	const exponentialDelay = options.baseDelayMs * options.backoffMultiplier ** attempt;

	// Cap at max delay
	const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);

	// Add jitter to prevent thundering herd
	if (options.jitter) {
		const jitterAmount = cappedDelay * 0.1; // 10% jitter
		const randomJitter = Math.random() * jitterAmount * 2 - jitterAmount;
		return Math.floor(cappedDelay + randomJitter);
	}

	return Math.floor(cappedDelay);
}

/**
 * Sleep for the specified duration with optional abort signal
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error("Request was aborted"));
			return;
		}
		const timeout = setTimeout(resolve, ms);
		signal?.addEventListener("abort", () => {
			clearTimeout(timeout);
			reject(new Error("Request was aborted"));
		});
	});
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(fn: () => Promise<T>, options: Partial<RetryOptions> = {}): Promise<T> {
	const opts: RetryOptions = {
		...DEFAULT_RETRY_OPTIONS,
		...options,
	};

	let lastError: unknown;

	for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			// Check if we should retry
			const shouldRetry = attempt < opts.maxRetries && (opts.isRetryable?.(error) ?? isRetryableError(error));

			if (!shouldRetry) {
				throw error;
			}

			// Calculate delay and sleep
			const delay = calculateDelay(attempt, opts);
			await sleep(delay);
		}
	}

	// This should never be reached, but TypeScript needs it
	throw lastError;
}

/**
 * Execute a function with retry logic for fetch requests
 * Handles both rate limits and transient errors
 */
export async function fetchWithRetry(
	url: string,
	options: RequestInit & { signal?: AbortSignal },
	retryOptions?: Partial<RetryOptions>,
): Promise<Response> {
	return withRetry(async () => {
		const response = await fetch(url, options);

		// Check if response is retryable (4xx/5xx errors)
		if (!response.ok) {
			const errorText = await response.text().catch(() => "");
			const error = new Error(`HTTP ${response.status}: ${errorText}`);
			Object.assign(error, {
				status: response.status,
				statusText: response.statusText,
			});
			throw error;
		}

		return response;
	}, retryOptions);
}
