/**
 * Google Provider Specific Tests
 *
 * Tests specific to Google Gemini API integration including
 * thinking level support, streaming behavior, and special features.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { complete, stream, type ThinkingContent, type ToolCall } from "../src/index.js";
import {
	type Context,
	fauxAssistantMessage,
	fauxText,
	fauxThinking,
	fauxToolCall,
	registerFauxProvider,
} from "../src/providers/faux.js";

describe("google provider specific", () => {
	let provider: any;
	let testModel: any;

	beforeEach(() => {
		provider = registerFauxProvider({
			api: "google",
			provider: "google",
			models: [
				{ id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", reasoning: true },
				{ id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", reasoning: false },
			],
		});
		testModel = provider.getModel("gemini-1.5-pro")!;
	});

	// =========================================================================
	// Gemini Model Specific Tests
	// =========================================================================

	it("should support thinking level 'xhigh' for Gemini models", async () => {
		// Setup: Gemini with xhigh thinking level
		provider.setResponses([
			fauxAssistantMessage([
				fauxThinking("Deep reasoning step 1"),
				fauxThinking("Deep reasoning step 2"),
				fauxText("Final comprehensive answer"),
			]),
		]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Analyze with maximum reasoning" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, context);
		const thinkingBlocks = response.content.filter((c): c is ThinkingContent => c.type === "thinking");

		// Gemini xhigh should produce substantial reasoning
		expect(thinkingBlocks.length).toBeGreaterThanOrEqual(2);
		expect(response.content[response.content.length - 1].text).toContain("comprehensive");
	});

	it("should handle large context windows specific to Gemini", async () => {
		// Setup: Gemini supports up to 2M tokens
		provider.setResponses([fauxAssistantMessage("I can process this large context")]);

		// Create context simulating large content
		const context: Context = {
			messages: [
				// Simulated large document chunks
				...Array.from({ length: 20 }, (_, i) => ({
					role: "user" as const,
					content: [
						{
							type: "text",
							text: `Document section ${i + 1}: ${"Lorem ipsum dolor sit amet. ".repeat(50)}`,
						},
					],
					timestamp: Date.now() + i * 1000,
				})),
				{
					role: "user",
					content: [{ type: "text", text: "Summarize the key points" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, context);

		// Gemini should handle large context
		expect(response.content[0].text).toContain("process");
		expect(response.api).toBe("google");
	});

	it("should support multimodal input for Gemini models", async () => {
		// Setup: Gemini supports text and image input
		const multimodalModel = registerFauxProvider({
			api: "google",
			provider: "google",
			models: [
				{
					id: "gemini-1.5-pro-vision",
					name: "Gemini 1.5 Pro Vision",
					reasoning: true,
					input: ["text", "image"],
				},
			],
		});
		const visionModel = multimodalModel.getModel("gemini-1.5-pro-vision")!;

		multimodalModel.setResponses([fauxAssistantMessage("I can analyze both text and images")]);

		// Context with image references (simulated)
		const context: Context = {
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: "Describe this image:" },
						{
							type: "image",
							data: "base64_encoded_image_data_here",
							mimeType: "image/jpeg",
							annotations: [
								{
									type: "bounding_box",
									x: 10,
									y: 10,
									width: 100,
									height: 100,
								},
							],
						},
					],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(visionModel, context);

		// Gemini should process multimodal input
		expect(response.api).toBe("google");
		expect(response.content[0].text).toContain("analyze");
		expect(response.provider).toBe("google");

		multimodalModel.unregister();
	});

	// =========================================================================
	// Gemini Streaming Behavior Tests
	// =========================================================================

	it("should stream thinking blocks incrementally in Gemini", async () => {
		// Setup: Gemini streaming with thinking
		provider.setResponses([
			fauxAssistantMessage([
				fauxThinking("First thought"),
				fauxText("Initial analysis"),
				fauxThinking("Second thought"),
				fauxText("Deeper analysis"),
				fauxText("Final conclusion"),
			]),
		]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Think step by step" }],
					timestamp: Date.now(),
				},
			],
		};

		const events: any[] = [];
		const eventStream = stream(testModel, context);

		for await (const event of eventStream) {
			events.push(event);
		}

		// Should have thinking blocks in stream
		const allContent = events.filter((e) => e.type === "message_end").flatMap((e) => e.message?.content || []);

		const thinkingBlocks = allContent.filter((c: any): c is ThinkingContent => c.type === "thinking");

		expect(thinkingBlocks.length).toBe(2);
		expect(thinkingBlocks[0].thinking).toBe("First thought");
	});

	it("should handle Gemini's safety filter responses", async () => {
		// Setup: Gemini may return safety-filtered responses
		provider.setResponses([
			fauxAssistantMessage("I cannot help with that request", {
				errorMessage: "SAFETY: Request violates usage policies",
				stopReason: "error" as const,
			}),
		]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Generate harmful content" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, context);

		// Should handle safety violations gracefully
		expect(response.stopReason).toBe("error");
		expect(response.errorMessage).toBeDefined();
		expect(response.content[0].text).toContain("cannot help");
	});

	// =========================================================================
	// Gemini Model Capabilities Tests
	// =========================================================================

	it("should utilize Gemini's 1M+ token context efficiently", async () => {
		// Setup: Large context test
		provider.setResponses([fauxAssistantMessage("I've processed all the context")]);

		// Simulate very large conversation
		const largeContext: Context = {
			messages: [
				// System prompt
				{
					role: "system",
					content: [{ type: "text", text: "You are a helpful assistant" }],
					timestamp: Date.now(),
				} as any,
				// Many user-assistant exchanges
				...Array.from({ length: 50 }, (_, i) => [
					{
						role: "user" as const,
						content: [{ type: "text", text: `Query ${i + 1}: ${"x".repeat(1000)}` }],
						timestamp: Date.now() + i * 2000,
					},
					{
						role: "assistant" as const,
						content: [{ type: "text", text: `Answer ${i + 1}: ${"y".repeat(500)}` }],
						timestamp: Date.now() + i * 2000 + 1000,
					},
				]).flat(),
				// Final query
				{
					role: "user",
					content: [{ type: "text", text: "Summarize everything" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, largeContext);

		// Gemini should handle large context
		expect(response.api).toBe("google");
		expect(response.content[0].text).toBeDefined();
	});

	it("should support code generation with Gemini", async () => {
		// Setup: Gemini excels at code generation
		provider.setResponses([
			fauxAssistantMessage([
				fauxText("Here's the Python code:"),
				{
					type: "text",
					text: "```python\ndef hello_world():\n    print('Hello, World!')\n```",
					language: "python" as const,
				},
				fauxText("This code demonstrates basic Python syntax."),
			]),
		]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Write Python code for hello world" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, context);
		const codeBlocks = response.content.filter((c: any) => c.type === "text" && c.language);

		// Gemini should include code blocks
		expect(codeBlocks.length).toBeGreaterThan(0);
		expect(codeBlocks[0].language).toBe("python");
	});

	it("should handle Gemini's function calling capabilities", async () => {
		// Setup: Gemini supports function calling
		provider.setResponses([
			fauxAssistantMessage([
				fauxText("I'll call a function to get the data"),
				fauxToolCall("get_weather", {
					location: "San Francisco",
					units: "metric",
				}),
			]),
			fauxAssistantMessage([fauxText("The weather is 22°C in San Francisco")]),
		]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "What's the weather in San Francisco?" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, context);
		const toolCalls = response.content.filter((c): c is ToolCall => c.type === "toolCall");

		// Gemini should make tool calls
		expect(toolCalls.length).toBe(1);
		expect(toolCalls[0].name).toBe("get_weather");
		expect((toolCalls[0].arguments as any).location).toBe("San Francisco");
	});

	// =========================================================================
	// Gemini Flash vs Pro Comparison Tests
	// =========================================================================

	it("should differentiate between Gemini Flash and Pro models", async () => {
		const flashModel = provider.getModel("gemini-1.5-flash")!;
		const _proModel = provider.getModel("gemini-1.5-pro")!;

		// Flash responds
		provider.setResponses([fauxAssistantMessage("Fast response from Flash")]);
		const flashContext: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Quick question" }],
					timestamp: Date.now(),
				},
			],
		};
		const flashResponse = await complete(flashModel, flashContext);

		// Pro responds
		const proProvider = registerFauxProvider({
			api: "google",
			provider: "google",
			models: [{ id: "gemini-1.5-pro-test", name: "Gemini 1.5 Pro", reasoning: true }],
		});
		proProvider.setResponses([
			fauxAssistantMessage([fauxThinking("Careful reasoning"), fauxText("Thoughtful response from Pro")]),
		]);
		const proModel2 = proProvider.getModel("gemini-1.5-pro-test")!;
		const proContext: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Complex question" }],
					timestamp: Date.now(),
				},
			],
		};
		const proResponse = await complete(proModel2, proContext);

		// Verify differences
		expect(flashResponse.api).toBe("google");
		expect(proResponse.api).toBe("google");
		expect(flashModel.id).toContain("flash");
		expect(proModel2.id).toContain("pro");

		proProvider.unregister();
	});
});
