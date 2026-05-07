/**
 * Example usage of Watchdog in Agent Session
 */

import { createAgentWatchdog, createToolWatchdog, Watchdog } from "./watchdog.js";

// ============================================================================
// Example 1: Basic Watchdog Usage
// ============================================================================

export function basicExample() {
	console.log("=== Basic Watchdog Example ===");

	const watchdog = new Watchdog({
		timeoutMs: 5000,
		name: "BasicExample",
		onTimeoutWarning: (remaining) => {
			console.log(`Warning: ${Math.round(remaining)}ms remaining`);
		},
		onTimeout: () => {
			console.log("Timeout occurred!");
		},
	});

	watchdog.start();

	// Simulate some work
	setTimeout(() => {
		console.log("Work completed");
		watchdog.stop();
	}, 3000);
}

// ============================================================================
// Example 2: Agent Session with Watchdog
// ============================================================================

export async function agentSessionExample() {
	console.log("\n=== Agent Session with Watchdog ===");

	const watchdog = createAgentWatchdog(10000); // 10 second timeout

	try {
		watchdog.start();

		// Simulate agent thinking
		await simulateThinking(2000);

		// Simulate tool execution
		await executeWithToolWatchdog();

		// Simulate more processing
		await simulateThinking(3000);

		console.log("Agent session completed successfully");
	} catch (error) {
		console.error("Agent session failed:", error);
	} finally {
		watchdog.stop();
	}
}

// ============================================================================
// Example 3: Long-running Operation with Timeout Extension
// ============================================================================

export async function longRunningOperationExample() {
	console.log("\n=== Long-running Operation Example ===");

	const watchdog = new Watchdog({
		timeoutMs: 5000,
		name: "LongOperation",
		onTimeoutWarning: (remaining) => {
			console.log(`Requesting extension, ${Math.round(remaining)}ms remaining`);
		},
		onTimeout: () => {
			console.log("Operation timeout - cancelling");
		},
	});

	watchdog.start();

	// Simulate work that needs more time
	for (let i = 0; i < 3; i++) {
		await simulateThinking(2000);

		if (watchdog.getTimeRemaining() < 3000) {
			console.log("Extending timeout...");
			watchdog.extend(5000); // Extend by 5 seconds
		}
	}

	watchdog.stop();
}

// ============================================================================
// Example 4: Concurrent Operations with Multiple Watchdogs
// ============================================================================

export async function concurrentOperationsExample() {
	console.log("\n=== Concurrent Operations Example ===");

	const mainWatchdog = createAgentWatchdog(15000); // 15 second overall

	mainWatchdog.start();

	try {
		// Run multiple tool operations concurrently
		await Promise.all([
			executeToolWithTimeout("download", 3000),
			executeToolWithTimeout("process", 4000),
			executeToolWithTimeout("upload", 5000),
		]);

		console.log("All tools completed");
	} catch (error) {
		console.error("Tool execution failed:", error);
	} finally {
		mainWatchdog.stop();
	}
}

// ============================================================================
// Example 5: Watchdog for Tool Execution
// ============================================================================

export async function toolExecutionExample() {
	console.log("\n=== Tool Execution with Watchdog ===");

	const toolTimeout = createToolWatchdog(8000);

	toolTimeout.start();

	try {
		// Simulate tool that might hang
		const result = await executeLongRunningTool(toolTimeout);
		console.log("Tool result:", result);
	} catch (error) {
		console.error("Tool execution failed:", error);
	} finally {
		toolTimeout.stop();
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

async function simulateThinking(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeWithToolWatchdog(): Promise<void> {
	const toolWatchdog = createToolWatchdog(5000);
	toolWatchdog.start();

	try {
		await simulateThinking(2000);
		console.log("Tool execution completed");
	} finally {
		toolWatchdog.stop();
	}
}

async function executeToolWithTimeout(name: string, duration: number): Promise<void> {
	const toolWatchdog = createToolWatchdog(10000);
	toolWatchdog.start();

	try {
		console.log(`Starting tool: ${name}`);
		await simulateThinking(duration);
		console.log(`Tool ${name} completed`);
	} finally {
		toolWatchdog.stop();
	}
}

async function executeLongRunningTool(watchdog: Watchdog): Promise<string> {
	// Simulate a tool that checks watchdog periodically
	for (let i = 0; i < 5; i++) {
		await simulateThinking(1000);

		// Check if we're running out of time
		const remaining = watchdog.getTimeRemaining();
		if (remaining < 3000) {
			throw new Error("Not enough time to complete operation");
		}

		console.log(`Progress: ${(i + 1) * 20}% (Time remaining: ${Math.round(remaining / 1000)}s)`);
	}

	return "Success";
}

// ============================================================================
// Run All Examples
// ============================================================================

if (require.main === module) {
	console.log("\n🚀 Watchdog Examples\n");

	basicExample();

	setTimeout(async () => {
		await agentSessionExample();
		await longRunningOperationExample();
		await concurrentOperationsExample();
		await toolExecutionExample();

		console.log("\n✅ All examples completed\n");
	}, 6000);
}
