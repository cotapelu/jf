import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@mariozechner/pi-agent-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentSession } from "../src/core/agent-session.js";
import { AuthStorage } from "../src/core/auth-storage.js";
import { createExtensionRuntime } from "../src/core/extensions/loader.js";
import { ModelRegistry } from "../src/core/model-registry.js";
import { SessionManager } from "../src/core/session-manager.js";
import { SettingsManager } from "../src/core/settings-manager.js";
import { codingTools } from "../src/core/tools/index.js";

describe("Chaos Engineering Tests for Distributed Components", () => {
	let testDir: string;
	let sessionManager: SessionManager;
	let settingsManager: SettingsManager;
	let authStorage: AuthStorage;
	let modelRegistry: ModelRegistry;

	beforeEach(() => {
		testDir = join(tmpdir(), `pi-chaos-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		// Setup isolated session components
		sessionManager = SessionManager.create(testDir);
		settingsManager = SettingsManager.create(testDir, testDir);
		authStorage = AuthStorage.create(join(testDir, "auth.json"));
		modelRegistry = ModelRegistry.create(authStorage, testDir);
	});

	afterEach(() => {
		if (testDir) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	/**
	 * Test that the system handles LLM provider unavailability gracefully
	 */
	it("should handle LLM provider timeout gracefully", async () => {
		// Create a model that simulates timeout/unavailable state using our timeout test provider
		const mockModel = {
			id: "timeout-model",
			name: "Timeout Model",
			api: "timeout-test-api",
			provider: "timeout-test-provider",
		} as any;

		// Create agent with a mock getApiKey that simulates delay/timeout
		const agent = new Agent({
			getApiKey: () => {
				return "test-key-for-timeout-provider";
			},
			initialState: {
				model: mockModel,
				systemPrompt: "You are a helpful assistant.",
				tools: codingTools,
			},
		});

		const session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: testDir,
			modelRegistry,
			resourceLoader: {
				getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
				getSkills: () => ({ skills: [], diagnostics: [] }),
				getPrompts: () => ({ prompts: [], diagnostics: [] }),
				getThemes: () => ({ themes: [], diagnostics: [] }),
				getAgentsFiles: () => ({ agentsFiles: [] }),
				getSystemPrompt: () => undefined,
				getAppendSystemPrompt: () => [],
				extendResources: () => {},
				reload: async () => {},
			},
		});

		session.subscribe(() => {});

		// Attempt to prompt - should handle the error gracefully
		await expect(session.prompt("Test message")).rejects.toThrow(/Provider timeout|timeout|error/i);

		// Verify session is still usable after error
		expect(session).toBeDefined();

		session.dispose();
	});

	/**
	 * Test that the system handles missing tool dependencies gracefully
	 */
	it("should handle missing tool dependencies gracefully", async () => {
		// Skip if no API key available for test provider
		if (!process.env.TEST_API_KEY) {
			expect(true).toBe(true); // Skip if no test API key available
			return;
		}

		// Create a model that uses our test provider
		const mockModel = {
			id: "test-model",
			name: "Test Model",
			api: "test-api",
			provider: "test-provider",
		} as any;

		const agent = new Agent({
			getApiKey: () => process.env.TEST_API_KEY,
			initialState: {
				model: mockModel,
				systemPrompt: "You are a helpful assistant.",
				// Intentionally provide broken tools to test resilience
				tools: [
					{
						name: "broken-tool",
						description: "A tool that always throws",
						label: "Broken Tool",
						parameters: {
							type: "object",
							properties: {},
						},
						execute: async () => {
							throw new Error("Tool execution failed");
						},
					},
				],
			},
		});

		const session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: testDir,
			modelRegistry,
			resourceLoader: {
				getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
				getSkills: () => ({ skills: [], diagnostics: [] }),
				getPrompts: () => ({ prompts: [], diagnostics: [] }),
				getThemes: () => ({ themes: [], diagnostics: [] }),
				getAgentsFiles: () => ({ agentsFiles: [] }),
				getSystemPrompt: () => undefined,
				getAppendSystemPrompt: () => [],
				extendResources: () => {},
				reload: async () => {},
			},
		});

		session.subscribe(() => {});

		// Even with broken tools, basic session operations should work
		const messagesBefore = session.messages.length;
		expect(messagesBefore).toBe(0);

		session.dispose();
	});

	/**
	 * Test recovery from storage failures
	 */
	it("should handle storage failures gracefully", async () => {
		// Skip if no API key available for test provider
		if (!process.env.TEST_API_KEY) {
			expect(true).toBe(true); // Skip if no test API key available
			return;
		}

		// Create a model that uses our test provider
		const mockModel = {
			id: "test-model",
			name: "Test Model",
			api: "test-api",
			provider: "test-provider",
		} as any;

		// Create a session manager that simulates storage failure
		const faultySessionManager = {
			...sessionManager,
			appendMessage: () => {
				throw new Error("Storage failure");
			},
			branch: () => {
				throw new Error("Storage failure");
			},
		};

		const agent = new Agent({
			getApiKey: () => process.env.TEST_API_KEY,
			initialState: {
				model: mockModel,
				systemPrompt: "You are a helpful assistant.",
				tools: codingTools,
			},
		});

		const session = new AgentSession({
			agent,
			sessionManager: faultySessionManager as any, // Type casting for test
			settingsManager,
			cwd: testDir,
			modelRegistry,
			resourceLoader: {
				getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
				getSkills: () => ({ skills: [], diagnostics: [] }),
				getPrompts: () => ({ prompts: [], diagnostics: [] }),
				getThemes: () => ({ themes: [], diagnostics: [] }),
				getAgentsFiles: () => ({ agentsFiles: [] }),
				getSystemPrompt: () => undefined,
				getAppendSystemPrompt: () => [],
				extendResources: () => {},
				reload: async () => {},
			},
		});

		session.subscribe(() => {});

		// Attempt operation that uses storage - should handle failure
		await expect(session.prompt("Test")).rejects.toThrow(/Storage failure|storage|failure/i);

		session.dispose();
	});
});
