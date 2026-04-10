import { beforeEach, describe, expect, it, vi } from "vitest";
import { LLMExtension, LLMWikiConfigSchema } from "../src/index";

// Mock completion function
const mockCompletionFn = vi.fn();

describe("LLMExtension", () => {
	let extension: LLMExtension;

	beforeEach(() => {
		extension = new LLMExtension(mockCompletionFn);
		vi.clearAllMocks();
	});

	it("should be instantiable with default config", () => {
		expect(extension).toBeInstanceOf(LLMExtension);
	});

	it("should accept custom configuration", () => {
		const customConfig = {
			defaultModel: "test-model",
			maxResults: 3,
			enableCache: false,
		};

		const extensionWithConfig = new LLMExtension(mockCompletionFn, customConfig);

		expect(extensionWithConfig).toBeInstanceOf(LLMExtension);
	});

	it("should validate configuration schema", () => {
		// Test valid config
		const validConfig = LLMWikiConfigSchema.parse({
			maxResults: 10,
			enableCache: true,
		});

		expect(validConfig.maxResults).toBe(10);
		expect(validConfig.enableCache).toBe(true);

		// Test invalid config (should throw)
		expect(() => {
			LLMWikiConfigSchema.parse({ maxResults: -1 });
		}).toThrow();
	});

	it("should call completion function when querying knowledge", async () => {
		// Mock the response
		mockCompletionFn.mockResolvedValue({
			content: JSON.stringify({
				results: [
					{
						title: "Test Article",
						content: "This is test content",
						relevance: 0.9,
					},
				],
			}),
		});

		const results = await extension.queryKnowledge("What is test?");

		expect(mockCompletionFn).toHaveBeenCalled();
		expect(results.length).toBe(1);
		expect(results[0].title).toBe("Test Article");
	});

	it("should handle empty results gracefully", async () => {
		mockCompletionFn.mockResolvedValue({
			content: JSON.stringify({ results: [] }),
		});

		const results = await extension.queryKnowledge("Unknown topic");
		expect(results.length).toBe(0);
	});

	it("should handle malformed JSON response", async () => {
		mockCompletionFn.mockResolvedValue({
			content: "Not valid JSON",
		});

		const results = await extension.queryKnowledge("Test question");
		expect(results.length).toBe(1);
		expect(results[0].content).toBe("Not valid JSON");
	});

	it("should cache results when enabled", async () => {
		const extensionWithCache = new LLMExtension(mockCompletionFn, {
			enableCache: true,
			cacheTTL: 60,
		});

		mockCompletionFn.mockResolvedValue({
			content: JSON.stringify({
				results: [{ title: "Cached", content: "Content", relevance: 0.8 }],
			}),
		});

		// First call
		const results1 = await extensionWithCache.queryKnowledge("test");
		expect(mockCompletionFn).toHaveBeenCalledTimes(1);

		// Second call with same question - should use cache
		const results2 = await extensionWithCache.queryKnowledge("test");
		expect(mockCompletionFn).toHaveBeenCalledTimes(1); // Still only called once
		expect(results1).toEqual(results2);
	});

	it("should not cache when disabled", async () => {
		const extensionWithoutCache = new LLMExtension(mockCompletionFn, {
			enableCache: false,
		});

		mockCompletionFn.mockResolvedValue({
			content: JSON.stringify({
				results: [{ title: "No Cache", content: "Content", relevance: 0.8 }],
			}),
		});

		// Two calls should both hit the completion function
		await extensionWithoutCache.queryKnowledge("test");
		await extensionWithoutCache.queryKnowledge("test");
		expect(mockCompletionFn).toHaveBeenCalledTimes(2);
	});

	it("should get cache stats", async () => {
		const extensionWithCache = new LLMExtension(mockCompletionFn, {
			enableCache: true,
		});

		mockCompletionFn.mockResolvedValue({
			content: JSON.stringify({
				results: [{ title: "Test", content: "Content", relevance: 0.8 }],
			}),
		});

		await extensionWithCache.queryKnowledge("test");
		const stats = extensionWithCache.getCacheStats();
		expect(stats.size).toBe(1);
	});

	it("should clear cache", async () => {
		const extensionWithCache = new LLMExtension(mockCompletionFn, {
			enableCache: true,
		});

		mockCompletionFn.mockResolvedValue({
			content: JSON.stringify({
				results: [{ title: "Test", content: "Content", relevance: 0.8 }],
			}),
		});

		await extensionWithCache.queryKnowledge("test");
		extensionWithCache.clearCache();
		const stats = extensionWithCache.getCacheStats();
		expect(stats.size).toBe(0);
	});
});
