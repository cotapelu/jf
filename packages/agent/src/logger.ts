// Logger utility for structured logging
import * as fs from "node:fs";
import * as os from "node:os";

export interface LogEntry {
	timestamp: string;
	level: "info" | "warn" | "error" | "debug";
	message: string;
	// Optional fields for structured data
	[key: string]: unknown;
}

export class Logger {
	public logFile: string | undefined;
	public minLevel: number;

	public static readonly levels: Record<string, number> = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3,
	};

	constructor(options: { logFile?: string; minLevel?: "info" | "warn" | "error" | "debug" } = {}) {
		this.logFile = options.logFile;
		this.minLevel = Logger.levels[options.minLevel ?? "info"];
	}

	private log(level: "info" | "warn" | "error" | "debug", message: string, meta: Record<string, unknown> = {}): void {
		const levelNum = Logger.levels[level];
		if (levelNum < this.minLevel) return;

		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			...meta,
		};

		const line = JSON.stringify(entry);
		if (this.logFile) {
			fs.appendFileSync(this.logFile, line + os.EOL, "utf8");
		} else {
			// Output to stdout as JSON line
			console.log(line);
		}
	}

	info(message: string, meta: Record<string, unknown> = {}): void {
		this.log("info", message, meta);
	}

	warn(message: string, meta: Record<string, unknown> = {}): void {
		this.log("warn", message, meta);
	}

	error(message: string, meta: Record<string, unknown> = {}): void {
		this.log("error", message, meta);
	}

	debug(message: string, meta: Record<string, unknown> = {}): void {
		this.log("debug", message, meta);
	}
}

// Default logger instance (can be replaced)
export const defaultLogger = new Logger();

// Helper to set log file (call early in application)
export function setLogFile(filePath: string): void {
	defaultLogger.logFile = filePath;
}

// Helper to set minimum log level
export function setLogLevel(level: "info" | "warn" | "error" | "debug"): void {
	defaultLogger.minLevel = Logger.levels[level];
}
