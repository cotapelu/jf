import { describe, expect, it, vi } from "vitest";
import {
	createTimer,
	enableJsonLogging,
	isJsonLoggingEnabled,
	log,
	logDuration,
	logError,
} from "../src/utils/logger.js";

describe("structured logging", () => {
	it("log outputs formatted message in human mode", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		enableJsonLogging(false);

		log("info", "Test message", { key: "value" });

		expect(consoleSpy).toHaveBeenCalled();
		expect(consoleSpy.mock.calls[0][0]).toContain("Test message");
		consoleSpy.mockRestore();
	});

	it("log outputs JSON in structured mode", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		enableJsonLogging(true);

		log("info", "Test message", { key: "value" });

		expect(consoleSpy).toHaveBeenCalled();
		const output = JSON.parse(consoleSpy.mock.calls[0][0]);
		expect(output.level).toBe("info");
		expect(output.message).toBe("Test message");
		expect(output.context).toEqual({ key: "value" });
		expect(output.timestamp).toBeDefined();
		consoleSpy.mockRestore();
	});

	it("logError includes error details", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		enableJsonLogging(true);

		const error = new Error("Test error");
		logError("Operation failed", error, { operation: "test" });

		expect(consoleSpy).toHaveBeenCalled();
		const output = JSON.parse(consoleSpy.mock.calls[0][0]);
		expect(output.level).toBe("error");
		expect(output.error.message).toBe("Test error");
		expect(output.error.stack).toBeDefined();
		consoleSpy.mockRestore();
	});

	it("logDuration measures sync function", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		enableJsonLogging(false);

		const result = logDuration("Operation", () => 42, { op: "add" });

		expect(result).toBe(42);
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it("logDuration measures async function", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		enableJsonLogging(false);

		const result = await logDuration("Async operation", async () => {
			await new Promise((r) => setTimeout(r, 10));
			return "done";
		});

		expect(result).toBe("done");
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it("createTimer returns timer that can be stopped", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		enableJsonLogging(false);

		const timer = createTimer("Measured operation");
		const duration = timer.stop();

		expect(duration).toBeGreaterThanOrEqual(0);
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it("isJsonLoggingEnabled returns current state", () => {
		enableJsonLogging(true);
		expect(isJsonLoggingEnabled()).toBe(true);

		enableJsonLogging(false);
		expect(isJsonLoggingEnabled()).toBe(false);
	});
});
