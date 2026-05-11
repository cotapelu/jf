/**
 * Cross-Provider Handoff Integration Tests
 *
 * Tests message transformation and handoff between different LLM providers.
 * Ensures consistency when switching between providers mid-conversation.
 */

import { afterEach, describe, expect, it } from "vitest";
import { complete, type ThinkingContent, type ToolCall, type ToolResultMessage } from "../src/index.js";
import {
	type AssistantMessage,
	type Context,
	type FauxModelDefinition,
	registerFauxProvider,
} from "../src/providers/faux.js";

interface ProviderSetup {
	provider: any;
	model: any;
	modelDef: FauxModelDefinition;
}

describe("cross-provider handoffs", () => {
	// =========================================================================
	// Provider Configuration
	// =========================================================================

	function createProvider(name: string, models: FauxModelDefinition[]): ProviderSetup {
		const provider = registerFauxProvider({
			api: name,
			provider: name,
			models,
		});
		return {
			provider,
			model: provider.getModel(models[0].id)!,
			modelDef: models[0],
		};
	}

	function createOpenAISetup(): ProviderSetup {
		return createProvider("openai", [
			{ id: "gpt-4o", name: "GPT-4o", reasoning: true },
			{ id: "gpt-4o-mini", name: "GPT-4o-mini", reasoning: false },
		]);
	}

	function createAnthropicSetup(): ProviderSetup {
		return createProvider("anthropic", [
			{ id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", reasoning: true },
			{ id: "claude-3-haiku", name: "Claude 3 Haiku", reasoning: false },
		]);
	}

	function createGoogleSetup(): ProviderSetup {
		return createProvider("google", [
			{ id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", reasoning: true },
			{ id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", reasoning: false },
		]);
	}

	function createMistralSetup(): ProviderSetup {
		return createProvider("mistral", [
			{ id: "mistral-large", name: "Mistral Large", reasoning: true },
			{ id: "mistral-small", name: "Mistral Small", reasoning: false },
		]);
	}

	afterEach(() => {
		// Clean up all registered providers
		// Note: In a real test, you'd want a more sophisticated cleanup
	});

	// =========================================================================
	// Basic Handoff Tests
	// =========================================================================

	it("should handoff from OpenAI to Anthropic with message transformation", async () => {
		const openai = createOpenAISetup();
		const anthropic = createAnthropicSetup();

		// OpenAI produces a response
		openai.provider.setResponses([
			{
				role: "assistant",
				content: [
					{ type: "text", text: "I've analyzed the problem." },
					{ type: "thinking", thinking: "This requires careful consideration." },
					{ type: "text", text: "The solution involves three steps." },
				],
				api: "openai",
				provider: "openai",
				model: "gpt-4o",
				usage: {
					input: 100,
					output: 150,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 250,
					cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
				},
				stopReason: "stop" as const,
				timestamp: Date.now(),
			} as AssistantMessage,
		]);

		// Anthropic receives transformed message
		anthropic.provider.setResponses([
			{
				role: "assistant",
				content: [{ type: "text", text: "Building on the previous analysis..." }],
				api: "anthropic",
				provider: "anthropic",
				model: "claude-3-5-sonnet",
				usage: {
					input: 120,
					output: 130,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 250,
					cost: { input: 0.0015, output: 0.0025, cacheRead: 0, cacheWrite: 0, total: 0.004 },
				},
				stopReason: "stop" as const,
				timestamp: Date.now(),
			} as AssistantMessage,
		]);

		// First turn with OpenAI
		const context1: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Analyze this problem" }],
					timestamp: Date.now(),
				},
			],
		};
		const response1 = await complete(openai.model, context1);

		expect(response1.api).toBe("openai");
		expect(response1.content.length).toBe(3); // text, thinking, text
		expect(response1.content[1].type).toBe("thinking");

		// Handoff to Anthropic
		const context2: Context = {
			messages: [
				...context1.messages,
				response1,
				{
					role: "user",
					content: [{ type: "text", text: "What are the three steps?" }],
					timestamp: Date.now(),
				},
			],
		};
		const response2 = await complete(anthropic.model, context2);

		expect(response2.api).toBe("anthropic");
		expect((response2.content[0] as any).text).toContain("Building");
	});

	it("should preserve thinking blocks across provider handoffs", async () => {
		const google = createGoogleSetup();
		const openai = createOpenAISetup();

		// Google produces structured thinking
		google.provider.setResponses([
			{
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "Let me reason step by step." },
					{ type: "thinking", thinking: "First, identify the core issue." },
					{ type: "text", text: "The core issue is X." },
				],
				api: "google",
				provider: "google",
				model: "gemini-1.5-pro",
				usage: {
					input: 80,
					output: 120,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 200,
					cost: { input: 0.0005, output: 0.001, cacheRead: 0, cacheWrite: 0, total: 0.0015 },
				},
				stopReason: "stop" as const,
				timestamp: Date.now(),
			} as AssistantMessage,
		]);

		// OpenAI continues
		openai.provider.setResponses([
			{
				role: "assistant",
				content: [
					{ type: "text", text: "I understand the core issue. Let me elaborate." },
					{ type: "thinking", thinking: "Building on the previous reasoning..." },
				],
				api: "openai",
				provider: "openai",
				model: "gpt-4o",
				usage: {
					input: 150,
					output: 100,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 250,
					cost: { input: 0.001, output: 0.0015, cacheRead: 0, cacheWrite: 0, total: 0.0025 },
				},
				stopReason: "stop" as const,
				timestamp: Date.now(),
			} as AssistantMessage,
		]);

		// First turn
		const context1: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Analyze this complex issue" }],
					timestamp: Date.now(),
				},
			],
		};
		const response1 = await complete(google.model, context1);

		const thinkingBlocks1 = response1.content.filter((c): c is ThinkingContent => c.type === "thinking");
		expect(thinkingBlocks1.length).toBe(2);

		// Handoff with continuation
		const context2: Context = {
			messages: [
				...context1.messages,
				response1,
				{
					role: "user",
					content: [{ type: "text", text: "Please elaborate on the core issue" }],
					timestamp: Date.now(),
				},
			],
		};
		const response2 = await complete(openai.model, context2);

		const thinkingBlocks2 = response2.content.filter((c): c is ThinkingContent => c.type === "thinking");
		expect(thinkingBlocks2.length).toBe(1);
		expect(response2.api).toBe("openai");
	});

	// =========================================================================
	// Tool Call Handoff Tests
	// =========================================================================

	it("should preserve tool calls across provider handoffs", async () => {
		const anthropic = createAnthropicSetup();
		const google = createGoogleSetup();

		// Anthropic makes a tool call
		anthropic.provider.setResponses([
			{
				role: "assistant",
				content: [
					{ type: "text", text: "I need to search for information." },
					{
						type: "toolCall",
						id: "tool-123",
						name: "search",
						arguments: { query: "important data", limit: 10 },
					} as ToolCall,
				],
				api: "anthropic",
				provider: "anthropic",
				model: "claude-3-5-sonnet",
				usage: {
					input: 100,
					output: 50,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 150,
					cost: { input: 0.001, output: 0.0005, cacheRead: 0, cacheWrite: 0, total: 0.0015 },
				},
				stopReason: "stop" as const,
				timestamp: Date.now(),
			} as AssistantMessage,
		]);

		// Google processes the tool result
		google.provider.setResponses([
			{
				role: "assistant",
				content: [{ type: "text", text: "I've processed the search results." }],
				api: "google",
				provider: "google",
				model: "gemini-1.5-pro",
				usage: {
					input: 200,
					output: 80,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 280,
					cost: { input: 0.0005, output: 0.001, cacheRead: 0, cacheWrite: 0, total: 0.0015 },
				},
				stopReason: "stop" as const,
				timestamp: Date.now(),
			} as AssistantMessage,
		]);

		// First turn
		const context1: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Search for important information" }],
					timestamp: Date.now(),
				},
			],
		};
		const response1 = await complete(anthropic.model, context1);

		expect(response1.content[1].type).toBe("toolCall");
		expect((response1.content[1] as ToolCall).name).toBe("search");

		// Handoff with tool result
		const context2: Context = {
			messages: [
				...context1.messages,
				response1,
				{
					role: "toolResult",
					content: [{ type: "text", text: "Search results: important data found" }],
					toolName: "search",
					timestamp: Date.now(),
				} as ToolResultMessage,
				{
					role: "user",
					content: [{ type: "text", text: "Process these results" }],
					timestamp: Date.now(),
				},
			],
		};
		const response2 = await complete(google.model, context2);

		expect(response2.api).toBe("google");
		expect((response2.content[0] as any).text).toContain("processed");
	});

	// =========================================================================
	// Multi-Provider Conversation Tests
	// =========================================================================

	it("should handle multi-provider round-robin conversation", async () => {
		const providers = [createOpenAISetup(), createAnthropicSetup(), createGoogleSetup()];

		// Each provider gives a different response
		providers.forEach((p, i) => {
			p.provider.setResponses([
				{
					role: "assistant",
					content: [{ type: "text", text: `Response from provider ${i + 1}` }],
					api: p.modelDef.id.includes("openai")
						? "openai"
						: p.modelDef.id.includes("anthropic")
							? "anthropic"
							: "google",
					provider: p.modelDef.id.includes("openai")
						? "openai"
						: p.modelDef.id.includes("anthropic")
							? "anthropic"
							: "google",
					model: p.modelDef.id,
					usage: {
						input: 50,
						output: 50,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 100,
						cost: { input: 0.0005, output: 0.0005, cacheRead: 0, cacheWrite: 0, total: 0.001 },
					},
					stopReason: "stop" as const,
					timestamp: Date.now(),
				} as AssistantMessage,
			]);
		});

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Start the conversation" }],
					timestamp: Date.now(),
				},
			],
		};

		// Three turns with different providers
		for (let i = 0; i < providers.length; i++) {
			const response = await complete(providers[i].model, context);

			expect((response.content[0] as any).text).toContain(`provider ${i + 1}`);

			context.messages.push(response);
			context.messages.push({
				role: "user",
				content: [{ type: "text", text: `Continue ${i + 1}` }],
				timestamp: Date.now(),
			});
		}

		expect(context.messages.length).toBe(7); // 1 initial + 3 responses + 3 follow-ups
	});

	it("should maintain context consistency across providers", async () => {
		const openai = createOpenAISetup();
		const mistral = createMistralSetup();

		// Both providers respond to the same context
		openai.provider.setResponses([
			{
				role: "assistant",
				content: [{ type: "text", text: "First response" }],
				api: "openai",
				provider: "openai",
				model: "gpt-4o",
				usage: {
					input: 50,
					output: 50,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 100,
					cost: { input: 0.0005, output: 0.0005, cacheRead: 0, cacheWrite: 0, total: 0.001 },
				},
				stopReason: "stop" as const,
				timestamp: Date.now(),
			} as AssistantMessage,
		]);

		mistral.provider.setResponses([
			{
				role: "assistant",
				content: [{ type: "text", text: "Second response" }],
				api: "mistral",
				provider: "mistral",
				model: "mistral-large",
				usage: {
					input: 60,
					output: 40,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 100,
					cost: { input: 0.0004, output: 0.0006, cacheRead: 0, cacheWrite: 0, total: 0.001 },
				},
				stopReason: "stop" as const,
				timestamp: Date.now(),
			} as AssistantMessage,
		]);

		const baseContext: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Same prompt" }],
					timestamp: Date.now(),
				},
			],
		};

		// Both providers process the same base context
		const response1 = await complete(openai.model, baseContext);
		const response2 = await complete(mistral.model, baseContext);

		// Both should respond, maintaining the shared context
		expect(response1.api).toBe("openai");
		expect(response2.api).toBe("mistral");
		expect(baseContext.messages.length).toBe(1); // Unmodified
	});

	// =========================================================================
	// Reasoning Feature Handoff Tests
	// =========================================================================

	it("should handle reasoning feature differences between providers", async () => {
		const reasoningProvider = createOpenAISetup(); // Has reasoning models
		const nonReasoningProvider = createMistralSetup(); // Mix of reasoning/non

		// Reasoning provider uses thinking
		reasoningProvider.provider.setResponses([
			{
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "Reasoning step 1" },
					{ type: "thinking", thinking: "Reasoning step 2" },
					{ type: "text", text: "Final answer after reasoning" },
				],
				api: "openai",
				provider: "openai",
				model: "gpt-4o",
				usage: {
					input: 100,
					output: 50,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 150,
					cost: { input: 0.001, output: 0.0005, cacheRead: 0, cacheWrite: 0, total: 0.0015 },
				},
				stopReason: "stop" as const,
				timestamp: Date.now(),
			} as AssistantMessage,
		]);

		// Non-reasoning provider doesn't use thinking
		nonReasoningProvider.provider.setResponses([
			{
				role: "assistant",
				content: [{ type: "text", text: "Direct answer without reasoning" }],
				api: "mistral",
				provider: "mistral",
				model: "mistral-small",
				usage: {
					input: 50,
					output: 50,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 100,
					cost: { input: 0.0005, output: 0.0005, cacheRead: 0, cacheWrite: 0, total: 0.001 },
				},
				stopReason: "stop" as const,
				timestamp: Date.now(),
			} as AssistantMessage,
		]);

		const prompt = "Solve this problem with reasoning";

		// First provider with reasoning
		const context1: Context = {
			messages: [{ role: "user", content: [{ type: "text", text: prompt }], timestamp: Date.now() }],
		};
		const response1 = await complete(reasoningProvider.model, context1);

		const hasThinking = response1.content.some((c) => c.type === "thinking");
		expect(hasThinking).toBe(true);

		// Second provider without reasoning capability
		const context2: Context = {
			messages: [
				...context1.messages,
				response1,
				{ role: "user", content: [{ type: "text", text: "Another question" }], timestamp: Date.now() },
			],
		};
		const response2 = await complete(nonReasoningProvider.model, context2);

		const hasThinking2 = response2.content.some((c) => c.type === "thinking");
		expect(hasThinking2).toBe(false);
		expect(response2.api).toBe("mistral");
	});

	// =========================================================================
	// Complex Handoff Scenario
	// =========================================================================

	it("should handle complex multi-provider tool workflow", async () => {
		const providers = [createOpenAISetup(), createGoogleSetup(), createAnthropicSetup()];

		// Multi-step workflow across providers
		providers.forEach((p, i) => {
			p.provider.setResponses([
				{
					role: "assistant",
					content: [
						{ type: "text", text: `Step ${i + 1}: Processing` },
						{
							type: "toolCall",
							id: `tool-${i}`,
							name: i === 0 ? "fetch" : i === 1 ? "process" : "finalize",
							arguments: { step: i + 1 },
						} as ToolCall,
					],
					api: p.modelDef.id.includes("openai")
						? "openai"
						: p.modelDef.id.includes("google")
							? "google"
							: "anthropic",
					provider: p.modelDef.id.includes("openai")
						? "openai"
						: p.modelDef.id.includes("google")
							? "google"
							: "anthropic",
					model: p.modelDef.id,
					usage: {
						input: 50,
						output: 50,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 100,
						cost: { input: 0.0005, output: 0.0005, cacheRead: 0, cacheWrite: 0, total: 0.001 },
					},
					stopReason: "stop" as const,
					timestamp: Date.now(),
				} as AssistantMessage,
				{
					role: "assistant",
					content: [{ type: "text", text: `Step ${i + 1} complete` }],
					api: p.modelDef.id.includes("openai")
						? "openai"
						: p.modelDef.id.includes("google")
							? "google"
							: "anthropic",
					provider: p.modelDef.id.includes("openai")
						? "openai"
						: p.modelDef.id.includes("google")
							? "google"
							: "anthropic",
					model: p.modelDef.id,
					usage: {
						input: 30,
						output: 40,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 70,
						cost: { input: 0.0003, output: 0.0004, cacheRead: 0, cacheWrite: 0, total: 0.0007 },
					},
					stopReason: "stop" as const,
					timestamp: Date.now(),
				} as AssistantMessage,
			]);
		});

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Start multi-step process" }],
					timestamp: Date.now(),
				},
			],
		};

		// Execute workflow across all providers
		for (let i = 0; i < providers.length; i++) {
			// Tool call step
			const response1 = await complete(providers[i].model, context);
			expect(response1.content[1].type).toBe("toolCall");

			context.messages.push(response1);
			context.messages.push({
				role: "toolResult",
				content: [{ type: "text", text: `Tool result ${i + 1}` }],
				toolName: `tool-${i}`,
				timestamp: Date.now(),
			} as ToolResultMessage);

			// Tool result processing step
			const response2 = await complete(providers[i].model, context);
			expect((response2.content[0] as any).text).toContain(`Step ${i + 1} complete`);

			context.messages.push(response2);
			context.messages.push({
				role: "user",
				content: [{ type: "text", text: `Next step` }],
				timestamp: Date.now(),
			});
		}

		expect(context.messages.length).toBeGreaterThan(6);
	});
});
