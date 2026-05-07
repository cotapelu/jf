/**
 * Structured logging utility for agent operations
 * Provides JSON logging option for observability
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
	context?: Record<string, unknown>;
	duration?: number;
	error?: {
		message: string;
		stack?: string;
	};
}

let jsonLoggingEnabled = false;

export function enableJsonLogging(enabled: boolean): void {
	jsonLoggingEnabled = enabled;
}

export function isJsonLoggingEnabled(): boolean {
	return jsonLoggingEnabled;
}

export function log(
	level: LogLevel,
	message: string,
	context?: Record<string, unknown>,
): void {
	const entry: LogEntry = {
		level,
		message,
		timestamp: new Date().toISOString(),
		...(context && { context }),
	};

	if (jsonLoggingEnabled) {
		console.log(JSON.stringify(entry));
	} else {
		const prefix = {
			debug: "🔧",
			info: "ℹ️",
			warn: "⚠️",
			error: "❌",
		}[level];
		console.log(`${prefix} ${message}`, context ? context : "");
	}
}

export function logError(
	message: string,
	error: Error | unknown,
	context?: Record<string, unknown>,
): void {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const errorStack = error instanceof Error ? error.stack : undefined;

	const entry: LogEntry = {
		level: "error",
		message,
		timestamp: new Date().toISOString(),
		error: {
			message: errorMessage,
			...(errorStack && { stack: errorStack }),
		},
		...(context && { context }),
	};

	if (jsonLoggingEnabled) {
		console.log(JSON.stringify(entry));
	} else {
		console.error(`❌ ${message}`, { error: errorMessage, ...context });
	}
}

export function logDuration<T>(
	message: string,
	fn: () => T,
	context?: Record<string, unknown>,
): T;
export function logDuration<T>(
	message: string,
	fn: () => Promise<T>,
	context?: Record<string, unknown>,
): Promise<T>;
export function logDuration<T>(
	message: string,
	fn: () => T | Promise<T>,
	context?: Record<string, unknown>,
): T | Promise<T> {
	const start = performance.now();
	const result = fn();

	if (result instanceof Promise) {
		return result.then((value) => {
			const duration = performance.now() - start;
			log("info", message, { ...context, duration: Math.round(duration) });
			return value;
		}).catch((error) => {
			const duration = performance.now() - start;
			logError(message, error, { ...context, duration: Math.round(duration) });
			throw error;
		});
	}

	const duration = performance.now() - start;
	log("info", message, { ...context, duration: Math.round(duration) });
	return result;
}

/**
 * Timer utility for measuring operation duration
 */
export class Timer {
	private start: number;
	private message: string;
	private context?: Record<string, unknown>;

	constructor(message: string, context?: Record<string, unknown>) {
		this.start = performance.now();
		this.message = message;
		this.context = context;
	}

	stop(): number {
		const duration = performance.now() - this.start;
		log("info", this.message, { ...this.context, duration: Math.round(duration) });
		return duration;
	}
}

export function createTimer(message: string, context?: Record<string, unknown>): Timer {
	return new Timer(message, context);
}
