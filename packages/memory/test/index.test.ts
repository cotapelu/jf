import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryEngine, createSQLiteStore, type MemoryInput, type MemoryType } from "../src/index.js";

describe("Coding Memory", () => {
	let store: ReturnType<typeof createSQLiteStore>;
	let engine: ReturnType<typeof createMemoryEngine>;

	beforeEach(() => {
		// Use in-memory database for tests
		store = createSQLiteStore(":memory:");
		engine = createMemoryEngine(store);
	});

	describe("save", () => {
		it("should save a memory with all fields", () => {
			const input: MemoryInput = {
				content: "User prefers 4 spaces for indentation",
				type: "preference",
				tags: ["style", "python"],
				weight: 0.8,
			};

			const result = engine.save(input);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toMatchObject({
					content: "User prefers 4 spaces for indentation",
					type: "preference",
					tags: ["style", "python"],
					weight: 0.8,
				});
				expect(result.value.id).toBeDefined();
				expect(result.value.created_at).toBeDefined();
				expect(result.value.access_count).toBe(0);
			}
		});

		it("should assign default weight", () => {
			const result = engine.save({
				content: "Project uses PostgreSQL",
				type: "project",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.weight).toBe(0.5);
			}
		});

		it("should reject empty content", () => {
			const result = engine.save({
				content: "",
				type: "preference",
			} as any);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("validation");
			}
		});

		it("should reject invalid type", () => {
			const result = engine.save({
				content: "Test",
				type: "invalid" as MemoryType,
			} as any);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("validation");
			}
		});
	});

	describe("find", () => {
		beforeEach(() => {
			engine.save({
				content: "User prefers 4 spaces for Python indentation",
				type: "preference",
				tags: ["style", "python"],
				weight: 0.9,
			});
			engine.save({
				content: "Project uses PostgreSQL database on port 5432",
				type: "project",
				tags: ["database", "postgres"],
				weight: 0.7,
			});
			engine.save({
				content: "Test command: npm run test:cov",
				type: "command",
				tags: ["testing", "npm"],
				weight: 0.6,
			});
			engine.save({
				content: "Bug fix: check for null before division",
				type: "solution",
				tags: ["bug", "math"],
				weight: 0.8,
			});
		});

		it("should find memories by query", () => {
			const result = engine.find("spaces indentation");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.total).toBeGreaterThan(0);
				expect(result.value.memories[0]).toMatchObject({
					type: "preference",
				});
			}
		});

		it("should filter by type", () => {
			const result = engine.find("project", { type: "project" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const mem of result.value.memories) {
					expect(mem.type).toBe("project");
				}
			}
		});

		it("should filter by tags", () => {
			const result = engine.find("project", { tags: ["database"] });

			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const mem of result.value.memories) {
					expect(mem.tags).toContain("database");
				}
			}
		});

		it("should respect limit", () => {
			const result = engine.find("test", { limit: 2 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.memories.length).toBeLessThanOrEqual(2);
			}
		});
	});

	describe("get", () => {
		it("should retrieve memory by id", () => {
			const saveResult = engine.save({
				content: "Test memory",
				type: "note",
			});
			if (!saveResult.ok) throw new Error("save failed");
			const id = saveResult.value.id;

			const getResult = engine.get(id);

			expect(getResult.ok).toBe(true);
			if (getResult.ok) {
				expect(getResult.value?.content).toBe("Test memory");
			}
		});

		it("should return null for non-existent id", () => {
			const result = engine.get("non_existent");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe("update", () => {
		it("should update memory content", async () => {
			const saveResult = engine.save({
				content: "Original",
				type: "preference",
			});
			if (!saveResult.ok) throw new Error("save failed");
			const id = saveResult.value.id;

			// Ensure timestamps differ
			await new Promise((r) => setTimeout(r, 2));

			const updateResult = engine.update(id, {
				content: "Updated",
			});

			expect(updateResult.ok).toBe(true);
			if (updateResult.ok) {
				expect(updateResult.value?.content).toBe("Updated");
				expect(updateResult.value?.updated_at).toBeGreaterThan(saveResult.value.created_at);
			}
		});

		it("should update tags", () => {
			const saveResult = engine.save({
				content: "Test",
				type: "note",
				tags: ["old"],
			});
			if (!saveResult.ok) throw new Error("save failed");
			const id = saveResult.value.id;

			const updateResult = engine.update(id, {
				tags: ["new", "tags"],
			});

			expect(updateResult.ok).toBe(true);
			if (updateResult.ok) {
				expect(updateResult.value?.tags).toEqual(["new", "tags"]);
			}
		});

		it("should return null for non-existent memory", () => {
			const result = engine.update("non_existent", {
				content: "New",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe("delete", () => {
		it("should delete a memory", () => {
			const saveResult = engine.save({
				content: "To delete",
				type: "note",
			});
			if (!saveResult.ok) throw new Error("save failed");
			const id = saveResult.value.id;

			const deleteResult = engine.delete(id);
			const getResult = engine.get(id);

			expect(deleteResult.ok).toBe(true);
			if (deleteResult.ok) {
				expect(deleteResult.value).toBe(true);
			}
			if (getResult.ok) {
				expect(getResult.value).toBeNull();
			}
		});

		it("should return false for non-existent memory", () => {
			const result = engine.delete("non_existent");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(false);
			}
		});
	});

	describe("stats", () => {
		it("should return correct statistics", () => {
			engine.save({ content: "1", type: "preference" });
			engine.save({ content: "2", type: "preference", tags: ["a"] });
			engine.save({ content: "3", type: "project", tags: ["a", "b"] });
			engine.save({ content: "4", type: "command", tags: ["b"] });

			const stats = engine.stats();

			expect(stats.ok).toBe(true);
			if (stats.ok) {
				expect(stats.value.total).toBe(4);
				expect(stats.value.byType.preference).toBe(2);
				expect(stats.value.byType.project).toBe(1);
				expect(stats.value.byType.command).toBe(1);
				expect(stats.value.byTags.a).toBe(2);
				expect(stats.value.byTags.b).toBe(2);
			}
		});
	});

	describe("clear", () => {
		it("should remove all memories", () => {
			engine.save({ content: "1", type: "preference" });
			engine.save({ content: "2", type: "project" });

			engine.clear();

			const stats = engine.stats();
			expect(stats.ok).toBe(true);
			if (stats.ok) {
				expect(stats.value.total).toBe(0);
			}
		});
	});

	describe("full-text search", () => {
		it("should search across content and tags", () => {
			engine.save({
				content: "Python indentation preferences",
				type: "preference",
				tags: ["python", "style"],
			});
			engine.save({
				content: "JavaScript linting rules",
				type: "preference",
				tags: ["javascript", "style"],
			});

			const result = engine.find("python");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.memories[0].tags).toContain("python");
			}
		});

		it("should not return expired memories", () => {
			// Not implementing expiration in test (future enhancement)
		});
	});
});

describe("LLM Tool Interface", () => {
	let engine: ReturnType<typeof createMemoryEngine>;

	beforeEach(() => {
		const store = createSQLiteStore(":memory:");
		engine = createMemoryEngine(store);
	});

	it("should have memory tool", async () => {
		const { createLLMToolInterface } = await import("../src/index.js");
		const tools = createLLMToolInterface(engine);

		const toolNames = tools.getTools().map((t) => t.name);
		expect(toolNames).toContain("memory");
	});

	it("should execute save operation", async () => {
		const { createLLMToolInterface } = await import("../src/index.js");
		const tools = createLLMToolInterface(engine);

		const result = await tools.executeTool("memory", {
			op: { op: "save", content: "User uses 4 spaces", type: "preference", tags: ["style"] },
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect((result.value as any).id).toBeDefined();
		}
	});

	it("should execute find operation", async () => {
		engine.save({
			content: "Python version is 3.11",
			type: "project",
			tags: ["python"],
		});

		const { createLLMToolInterface } = await import("../src/index.js");
		const tools = createLLMToolInterface(engine);

		const result = await tools.executeTool("memory", {
			op: { op: "find", query: "python" },
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect((result.value as any).total).toBe(1);
		}
	});

	it("should format tool results properly", async () => {
		const { createLLMToolInterface } = await import("../src/index.js");
		const tools = createLLMToolInterface(engine);

		const result = await tools.executeTool("memory", { op: { op: "stats" } });
		const formatted = tools.formatToolResult(result);

		const parsed = JSON.parse(formatted);
		expect(parsed.success).toBe(true);
		expect(parsed.data).toBeDefined();
	});

	it("should generate system prompt with instructions", async () => {
		const { createLLMToolInterface } = await import("../src/index.js");
		const tools = createLLMToolInterface(engine);

		const prompt = tools.generateSystemPrompt();

		expect(prompt).toContain("memory");
		expect(prompt).toContain("save");
		expect(prompt).toContain("find");
		expect(prompt).toContain("preference");
		expect(prompt).toContain("project");
	});
});
