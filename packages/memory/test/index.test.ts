import { beforeEach, describe, expect, it } from "vitest";
import {
	createMemoryEngine,
	createMemoryStore,
	err,
	type MemoryInput,
	type MemoryType,
	matchResult,
	ok,
} from "./src/index.js";

describe("Memory Engine", () => {
	let memory: ReturnType<typeof createMemoryEngine>;

	beforeEach(() => {
		memory = createMemoryEngine();
	});

	describe("createMemory", () => {
		it("should create a memory with all fields", () => {
			const input: MemoryInput = {
				type: "long_term",
				content: { text: "User prefers dark mode" },
				tags: ["preference", "ui"],
				weight: 0.8,
			};

			const result = memory.createMemory(input);

			expect(result.ok).toBe(true);
			expect(result.value).toMatchObject({
				type: "long_term",
				content: { text: "User prefers dark mode" },
				tags: ["preference", "ui"],
				weight: 0.8,
			});
			expect(result.value.id).toBeDefined();
			expect(result.value.createdAt).toBeDefined();
			expect(result.value.updatedAt).toBeDefined();
			expect(result.value.accessCount).toBe(0);
		});

		it("should assign default weight when not provided", () => {
			const result = memory.createMemory({
				type: "short_term",
				content: { text: "Test" },
			});

			expect(result.ok).toBe(true);
			expect(result.value.weight).toBe(0.5);
		});

		it("should assign default tags when not provided", () => {
			const result = memory.createMemory({
				type: "semantic",
				content: { text: "Test" },
			});

			expect(result.ok).toBe(true);
			expect(result.value.tags).toEqual([]);
		});

		it("should reject invalid memory type", () => {
			const result = memory.createMemory({
				type: "invalid_type" as MemoryType,
				content: { text: "Test" },
			});

			expect(result.ok).toBe(false);
		});

		it("should reject empty content", () => {
			const result = memory.createMemory({
				type: "long_term",
				content: { text: "" },
			});

			expect(result.ok).toBe(false);
		});

		it("should reject content exceeding max length", () => {
			const longText = "x".repeat(10001);
			const result = memory.createMemory({
				type: "long_term",
				content: { text: longText },
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("getMemory", () => {
		it("should retrieve a memory by id", () => {
			const createResult = memory.createMemory({
				type: "long_term",
				content: { text: "Test memory" },
			});

			const getResult = memory.getMemory(createResult.value!.id);

			expect(getResult.ok).toBe(true);
			expect(getResult.value?.content.text).toBe("Test memory");
		});

		it("should return null for non-existent id", () => {
			const result = memory.getMemory("non_existent_id");

			expect(result.ok).toBe(true);
			expect(result.value).toBeNull();
		});
	});

	describe("updateMemory", () => {
		it("should update memory content", async () => {
			const createResult = memory.createMemory({
				type: "long_term",
				content: { text: "Original text" },
			});
			const id = createResult.value!.id;

			// Wait a bit to ensure different timestamp
			await new Promise((r) => setTimeout(r, 10));

			const updateResult = memory.updateMemory(id, {
				content: { text: "Updated text" },
			});

			expect(updateResult.ok).toBe(true);
			expect(updateResult.value?.content.text).toBe("Updated text");
			expect(updateResult.value?.updatedAt).toBeGreaterThanOrEqual(createResult.value!.createdAt);
		});

		it("should update tags", () => {
			const createResult = memory.createMemory({
				type: "long_term",
				content: { text: "Test" },
				tags: ["old"],
			});
			const id = createResult.value!.id;

			const updateResult = memory.updateMemory(id, {
				tags: ["new", "tags"],
			});

			expect(updateResult.ok).toBe(true);
			expect(updateResult.value?.tags).toEqual(["new", "tags"]);
		});

		it("should return error for non-existent memory", () => {
			const result = memory.updateMemory("non_existent", {
				content: { text: "New text" },
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("deleteMemory", () => {
		it("should delete a memory", () => {
			const createResult = memory.createMemory({
				type: "long_term",
				content: { text: "To be deleted" },
			});
			const id = createResult.value!.id;

			const deleteResult = memory.deleteMemory(id);
			const getResult = memory.getMemory(id);

			expect(deleteResult.ok).toBe(true);
			expect(deleteResult.value).toBe(true);
			expect(getResult.value).toBeNull();
		});

		it("should return error for non-existent memory", () => {
			const result = memory.deleteMemory("non_existent");

			expect(result.ok).toBe(false);
		});
	});

	describe("retrieve", () => {
		beforeEach(() => {
			// Create test memories
			memory.createMemory({
				type: "long_term",
				content: { text: "User prefers dark mode interface" },
				tags: ["preference", "ui"],
				weight: 0.8,
			});

			memory.createMemory({
				type: "long_term",
				content: { text: "User likes coffee in the morning" },
				tags: ["preference", "food"],
				weight: 0.6,
			});

			memory.createMemory({
				type: "short_term",
				content: { text: "Current conversation about coding" },
				tags: ["conversation"],
				weight: 0.5,
			});

			memory.createMemory({
				type: "semantic",
				content: { text: "TypeScript is a typed superset of JavaScript" },
				tags: ["knowledge", "programming"],
				weight: 0.7,
			});
		});

		it("should retrieve memories matching query", () => {
			const result = memory.retrieve("user preferences interface");

			expect(result.ok).toBe(true);
			expect(result.value.length).toBeGreaterThan(0);
		});

		it("should return ranked results with scores", () => {
			const result = memory.retrieve("dark mode");

			expect(result.ok).toBe(true);
			expect(result.value[0]).toHaveProperty("score");
			expect(result.value[0]).toHaveProperty("reasons");
			expect(result.value[0].memory.type).toBe("long_term");
		});

		it("should filter by types", () => {
			const result = memory.retrieve("preferences", {
				types: ["long_term"],
			});

			expect(result.ok).toBe(true);
			for (const ranked of result.value) {
				expect(ranked.memory.type).toBe("long_term");
			}
		});

		it("should filter by tags", () => {
			const result = memory.retrieve("user", {
				tags: ["preference"],
			});

			expect(result.ok).toBe(true);
			for (const ranked of result.value) {
				expect(ranked.memory.tags).toContain("preference");
			}
		});

		it("should limit results", () => {
			const result = memory.retrieve("user", {
				limit: 2,
			});

			expect(result.ok).toBe(true);
			expect(result.value.length).toBeLessThanOrEqual(2);
		});

		it("should return empty array for low minScore", () => {
			const result = memory.retrieve("user preferences", {
				minScore: 1.0, // Very high threshold
			});

			expect(result.ok).toBe(true);
			// No memories will have score 1.0
			expect(result.value.length).toBe(0);
		});
	});

	describe("buildContext", () => {
		beforeEach(() => {
			memory.createMemory({
				type: "long_term",
				content: { text: "User prefers dark mode" },
				tags: ["preference", "ui"],
				weight: 0.8,
			});

			memory.createMemory({
				type: "semantic",
				content: { text: "TypeScript is a typed language" },
				tags: ["knowledge", "programming"],
				weight: 0.7,
			});
		});

		it("should build context with memories", () => {
			const result = memory.buildContext("user preferences");

			expect(result.ok).toBe(true);
			expect(result.value.text).toContain("dark mode");
			expect(result.value.metadata.query).toBe("user preferences");
			expect(result.value.metadata.includedCount).toBeGreaterThan(0);
		});

		it("should respect limit option", () => {
			const result = memory.buildContext("user preferences programming", {
				limit: 1,
			});

			expect(result.ok).toBe(true);
			expect(result.value.metadata.includedCount).toBe(1);
		});

		it("should filter by memory types", () => {
			const result = memory.buildContext("user programming", {
				types: ["semantic"],
			});

			expect(result.ok).toBe(true);
			expect(result.value.memories.every((m) => m.memory.type === "semantic")).toBe(true);
		});
	});

	describe("searchByTags", () => {
		beforeEach(() => {
			memory.createMemory({
				type: "long_term",
				content: { text: "Memory 1" },
				tags: ["tag1", "tag2"],
			});

			memory.createMemory({
				type: "short_term",
				content: { text: "Memory 2" },
				tags: ["tag2", "tag3"],
			});

			memory.createMemory({
				type: "semantic",
				content: { text: "Memory 3" },
				tags: ["tag3"],
			});
		});

		it("should find memories with matching tags", () => {
			const result = memory.searchByTags(["tag1"]);

			expect(result.ok).toBe(true);
			expect(result.value.length).toBe(1);
			expect(result.value[0].content.text).toBe("Memory 1");
		});

		it("should respect limit", () => {
			const result = memory.searchByTags(["tag2"], 1);

			expect(result.ok).toBe(true);
			expect(result.value.length).toBe(1);
		});
	});

	describe("listMemories", () => {
		beforeEach(() => {
			memory.createMemory({ type: "long_term", content: { text: "1" } });
			memory.createMemory({ type: "short_term", content: { text: "2" } });
			memory.createMemory({ type: "long_term", content: { text: "3" } });
		});

		it("should list all memories", () => {
			const result = memory.listMemories();

			expect(result.ok).toBe(true);
			expect(result.value.length).toBe(3);
		});

		it("should filter by type", () => {
			const result = memory.listMemories({ type: "long_term" });

			expect(result.ok).toBe(true);
			expect(result.value.length).toBe(2);
		});
	});

	describe("getStats", () => {
		it("should return correct statistics", () => {
			memory.createMemory({ type: "long_term", content: { text: "1" }, tags: ["a"] });
			memory.createMemory({ type: "long_term", content: { text: "2" }, tags: ["a", "b"] });
			memory.createMemory({ type: "short_term", content: { text: "3" }, tags: ["b"] });

			const stats = memory.getStats();

			expect(stats.totalMemories).toBe(3);
			expect(stats.byType.long_term).toBe(2);
			expect(stats.byType.short_term).toBe(1);
			expect(stats.byTags.a).toBe(2);
			expect(stats.byTags.b).toBe(2);
		});
	});
});

describe("LLM Tool Interface", () => {
	it("should execute create_memory tool", async () => {
		const memory = createMemoryEngine();
		const { createLLMToolInterface } = await import("./src/llm/tools.js");

		const tools = createLLMToolInterface(memory);
		const result = await tools.executeTool("create_memory", {
			type: "long_term",
			content: { text: "Test memory" },
			tags: ["test"],
		});

		expect(result.ok).toBe(true);
	});

	it("should execute retrieve_memories tool", async () => {
		const memory = createMemoryEngine();
		memory.createMemory({ type: "long_term", content: { text: "Test" } });
		const { createLLMToolInterface } = await import("./src/llm/tools.js");

		const tools = createLLMToolInterface(memory);
		const result = await tools.executeTool("retrieve_memories", {
			query: "test",
			limit: 5,
		});

		expect(result.ok).toBe(true);
	});

	it("should execute delete_memory tool", async () => {
		const memory = createMemoryEngine();
		const createResult = memory.createMemory({ type: "long_term", content: { text: "To delete" } });
		const { createLLMToolInterface } = await import("./src/llm/tools.js");

		const tools = createLLMToolInterface(memory);
		const result = await tools.executeTool("delete_memory", {
			id: createResult.value!.id,
		});

		expect(result.ok).toBe(true);
	});

	it("should return error for unknown tool", async () => {
		const memory = createMemoryEngine();
		const { createLLMToolInterface } = await import("./src/llm/tools.js");

		const tools = createLLMToolInterface(memory);
		const result = await tools.executeTool("unknown_tool", {});

		expect(result.ok).toBe(false);
	});

	it("should get tool definitions", async () => {
		const memory = createMemoryEngine();
		const { createLLMToolInterface } = await import("./src/llm/tools.js");

		const tools = createLLMToolInterface(memory);
		const toolDefs = tools.getTools();

		expect(toolDefs.length).toBeGreaterThan(0);
		expect(toolDefs.find((t) => t.name === "create_memory")).toBeDefined();
		expect(toolDefs.find((t) => t.name === "retrieve_memories")).toBeDefined();
	});
});

describe("Memory Store", () => {
	it("should create in-memory store", () => {
		const store = createMemoryStore();

		const memory = store.create({
			type: "long_term",
			content: { text: "Test" },
		});

		expect(memory.id).toBeDefined();
		expect(store.get(memory.id)).toEqual(memory);
	});

	it("should query by type", () => {
		const store = createMemoryStore();

		store.create({ type: "long_term", content: { text: "1" } });
		store.create({ type: "short_term", content: { text: "2" } });
		store.create({ type: "long_term", content: { text: "3" } });

		const results = store.query({ type: "long_term" });

		expect(results.length).toBe(2);
	});

	it("should query by tags (AND logic)", () => {
		const store = createMemoryStore();

		store.create({ type: "long_term", content: { text: "1" }, tags: ["a", "b"] });
		store.create({ type: "long_term", content: { text: "2" }, tags: ["a"] });
		store.create({ type: "long_term", content: { text: "3" }, tags: ["b", "c"] });

		const results = store.query({ tags: ["a", "b"] });

		expect(results.length).toBe(1);
		expect(results[0].content.text).toBe("1");
	});

	it("should count memories", () => {
		const store = createMemoryStore();

		store.create({ type: "long_term", content: { text: "1" } });
		store.create({ type: "short_term", content: { text: "2" } });

		expect(store.count()).toBe(2);
		expect(store.count({ type: "long_term" })).toBe(1);
	});
});

describe("Result Type", () => {
	it("should work with ok result", () => {
		const result = ok("value");
		expect(result.ok).toBe(true);
		expect(result.value).toBe("value");

		const outcome = matchResult(
			result,
			(v) => `got: ${v}`,
			(e) => `error: ${e.message}`,
		);
		expect(outcome).toBe("got: value");
	});

	it("should work with error result", () => {
		const result = err(new Error("test error"));
		expect(result.ok).toBe(false);
		expect(result.error.message).toBe("test error");

		const outcome = matchResult(
			result,
			(v) => `got: ${v}`,
			(e) => `error: ${e.message}`,
		);
		expect(outcome).toBe("error: test error");
	});
});
