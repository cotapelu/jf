import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readTool } from "../src/core/tools/read.js";

// Helper to extract text from content blocks
function getTextOutput(result: any): string {
	return (
		result.content
			?.filter((c: any) => c.type === "text")
			.map((c: any) => c.text)
			.join("\n") || ""
	);
}

describe("Read Tool Properties", () => {
	let testDir: string;

	beforeEach(() => {
		// Create a unique temporary directory for each test
		testDir = join(__dirname, `fixtures`, `property-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	// Simple test: Reading a file should return the exact content for small files
	it("should return exact content for small files", async () => {
		const testFile = join(testDir, "test.txt");
		const content = "Hello, world!";
		writeFileSync(testFile, content, "utf8");

		const result = await readTool.execute("test-call", { path: testFile });
		const output = getTextOutput(result);

		// For small files, should not be truncated
		expect(output).toBe(content);
	});

	// Simple test: Reading with offset should start from the specified line number (1-indexed)
	it("should start reading from the specified line number", async () => {
		const testFile = join(testDir, "offset-test.txt");
		const lines = ["Line 1", "Line 2", "Line 3", "Line 4", "Line 5"];
		const fileContent = lines.join("\n");
		writeFileSync(testFile, fileContent, "utf8");

		const result = await readTool.execute("test-call", { path: testFile, offset: 2 });
		const output = getTextOutput(result);

		// Should start from line 2 (1-indexed)
		expect(output).toBe("Line 2\nLine 3\nLine 4\nLine 5");
	});

	// Simple test: Reading with limit should return at most the specified number of lines plus continuation message
	it("should limit lines with limit and show continuation message", async () => {
		const testFile = join(testDir, "limit-test.txt");
		const lines = ["Line 1", "Line 2", "Line 3", "Line 4", "Line 5"];
		const fileContent = lines.join("\n");
		writeFileSync(testFile, fileContent, "utf8");

		const result = await readTool.execute("test-call", { path: testFile, limit: 3 });
		const output = getTextOutput(result);

		// Should return first 3 lines plus continuation message
		expect(output).toContain("Line 1");
		expect(output).toContain("Line 2");
		expect(output).toContain("Line 3");
		expect(output).toContain("[2 more lines in file. Use offset=4 to continue.]");
	});
});
