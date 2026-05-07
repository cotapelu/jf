/**
 * Watchdog Timer for Agent Session Timeout Protection
 * 
 * Prevents infinite loops and runaway agent execution by enforcing
 * time limits on agent operations.
 */

export interface WatchdogOptions {
	/** Maximum execution time in milliseconds */
	timeoutMs: number;
	/** Check interval in milliseconds */
	checkIntervalMs?: number;
	/** Callback when timeout is about to occur */
	onTimeoutWarning?: (timeRemaining: number) => void;
	/** Callback when timeout occurs */
	onTimeout?: () => void;
	/** Name for debugging */
	name?: string;
}

/**
 * Watchdog timer that monitors agent execution time
 */
export class Watchdog {
	private startTime: number;
	private timeoutMs: number;
	private checkIntervalMs: number;
	private onTimeoutWarning?: (timeRemaining: number) => void;
	private onTimeout?: () => void;
	private name: string;
	private isRunning: boolean = false;
	private intervalId: NodeJS.Timeout | null = null;
	private timeoutId: NodeJS.Timeout | null = null;
	private readonly WARNING_THRESHOLD = 0.8; // Warn at 80% of timeout

	constructor(options: WatchdogOptions) {
		this.timeoutMs = options.timeoutMs;
		this.checkIntervalMs = options.checkIntervalMs || 1000;
		this.onTimeoutWarning = options.onTimeoutWarning;
		this.onTimeout = options.onTimeout;
		this.name = options.name || 'Watchdog';
		this.startTime = Date.now();
	}

	/**
	 * Start the watchdog timer
	 */
	start(): void {
		if (this.isRunning) {
			return;
		}

		this.isRunning = true;
		this.startTime = Date.now();

		// Set main timeout
		this.timeoutId = setTimeout(() => {
			this.handleTimeout();
		}, this.timeoutMs);

		// Start periodic checks for warnings
		this.intervalId = setInterval(() => {
			this.checkTimeRemaining();
		}, this.checkIntervalMs);

		console.log(`[${this.name}] Watchdog started (${this.timeoutMs}ms timeout)`);
	}

	/**
	 * Stop the watchdog timer
	 */
	stop(): void {
		if (!this.isRunning) {
			return;
		}

		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}

		this.isRunning = false;
		const elapsed = Date.now() - this.startTime;
		console.log(`[${this.name}] Watchdog stopped (elapsed: ${elapsed}ms)`);
	}

	/**
	 * Reset the watchdog timer
	 */
	reset(): void {
		this.stop();
		this.start();
	}

	/**
	 * Check if watchdog is currently running
	 */
	isActive(): boolean {
		return this.isRunning;
	}

	/**
	 * Get elapsed time since start
	 */
	getElapsedTime(): number {
		return Date.now() - this.startTime;
	}

	/**
	 * Get remaining time before timeout
	 */
	getTimeRemaining(): number {
		const elapsed = this.getElapsedTime();
		return Math.max(0, this.timeoutMs - elapsed);
	}

	/**
	 * Check time remaining and trigger warnings if needed
	 */
	private checkTimeRemaining(): void {
		const remaining = this.getTimeRemaining();
		const warningThreshold = this.timeoutMs * this.WARNING_THRESHOLD;
		const warningTime = this.timeoutMs - warningThreshold;

		if (remaining <= warningTime && this.onTimeoutWarning) {
			this.onTimeoutWarning(remaining);
		}
	}

	/**
	 * Handle timeout event
	 */
	private handleTimeout(): void {
		this.isRunning = false;
		
		console.error(`[${this.name}] Watchdog timeout after ${this.timeoutMs}ms`);
		
		if (this.onTimeout) {
			this.onTimeout();
		}
	}

	/**
	 * Extend the timeout by additional milliseconds
	 */
	extend(additionalMs: number): void {
		if (!this.isRunning) {
			return;
		}

		this.timeoutMs += additionalMs;
		this.reset();
		console.log(`[${this.name}] Watchdog extended by ${additionalMs}ms`);
	}

	/**
	 * Get current timeout value
	 */
	getTimeout(): number {
		return this.timeoutMs;
	}
}

/**
 * Create a watchdog with default settings for agent operations
 */
export function createAgentWatchdog(timeoutMs: number = 30000): Watchdog {
	return new Watchdog({
		timeoutMs,
		checkIntervalMs: 1000,
		name: 'AgentSession',
		onTimeoutWarning: (remaining) => {
			console.warn(`[AgentSession] Timeout warning: ${Math.round(remaining / 1000)}s remaining`);
		},
		onTimeout: () => {
			console.error('[AgentSession] Execution timeout - stopping agent');
		}
	});
}

/**
 * Create a watchdog for tool execution
 */
export function createToolWatchdog(timeoutMs: number = 10000): Watchdog {
	return new Watchdog({
		timeoutMs,
		checkIntervalMs: 500,
		name: 'ToolExecution',
		onTimeoutWarning: (remaining) => {
			console.warn(`[ToolExecution] Tool timeout warning: ${Math.round(remaining / 1000)}s remaining`);
		},
		onTimeout: () => {
			console.error('[ToolExecution] Tool execution timeout');
		}
	});
}
