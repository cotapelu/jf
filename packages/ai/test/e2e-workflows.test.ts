/**
 * End-to-End Workflow Tests
 *
 * Tests complete user workflows from start to finish, ensuring all
 * components work together correctly.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Context, complete, stream } from "../src/index.js";
import {
	fauxAssistantMessage,
	fauxText,
	fauxThinking,
	fauxToolCall,
	registerFauxProvider,
} from "../src/providers/faux.js";

describe("end-to-end workflows", () => {
	let provider: any;
	let testModel: any;

	beforeEach(() => {
		provider = registerFauxProvider({
			models: [{ id: "e2e-test", name: "E2E Test Model" }],
		});
		testModel = provider.getModel("e2e-test")!;
	});

	afterEach(() => {
		provider.unregister();
	});

	// =========================================================================
	// Basic Conversation Workflows
	// =========================================================================

	it("should handle simple Q&A conversation", async () => {
		// Setup: Simple question and answer
		provider.setResponses([fauxAssistantMessage("The capital of France is Paris.")]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "What is the capital of France?" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, context);

		// Verification
		expect(response.role).toBe("assistant");
		expect((response.content[0] as any).text).toContain("Paris");
	});

	it("should handle multi-turn conversation", async () => {
		// Setup: Multiple exchanges
		const responses = [
			fauxAssistantMessage("I can help you calculate that."),
			fauxAssistantMessage("Please provide the numbers you want to multiply."),
			fauxAssistantMessage("The result is 42."),
		];

		responses.forEach((resp, i) => {
			const p = registerFauxProvider({
				models: [{ id: `multi-turn-${i}`, name: `Multi Turn ${i}` }],
			});
			p.setResponses([resp]);
			if (i === 0) {
				provider = p;
				testModel = p.getModel(`multi-turn-${i}`)!;
			}
		});

		// First turn
		const context1: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Can you help me with math?" }],
					timestamp: Date.now(),
				},
			],
		};
		const response1 = await complete(testModel, context1);
		expect((response1.content[0] as any).text).toContain("calculate");

		// Second turn
		const context2: Context = {
			messages: [
				{
					role: "user" as const,
					content: [{ type: "text" as const, text: "Can you help me with math?" }],
					timestamp: Date.now(),
				},
				{
					role: "assistant" as const,
					content: [{ type: "text" as const, text: "I can help you calculate that." }],
					timestamp: Date.now(),
				},
				{
					role: "user" as const,
					content: [{ type: "text" as const, text: "What is 6 times 7?" }],
					timestamp: Date.now(),
				},
			],
		} as any;
		const response2 = await complete(testModel, context2);
		expect((response2.content[0] as any).text).toContain("numbers");
	});

	it("should handle follow-up questions with context", async () => {
		// Setup: Conversational context
		provider.setResponses([
			fauxAssistantMessage("I am an AI assistant."),
			fauxAssistantMessage("I can help you with your project."),
		]);

		// First message
		const context1: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Who are you?" }],
					timestamp: Date.now(),
				},
			],
		};
		await complete(testModel, context1);

		// Follow-up with context
		const context2: Context = {
			messages: [
				{
					role: "user" as const,
					content: [{ type: "text" as const, text: "Who are you?" }],
					timestamp: Date.now(),
				},
				{
					role: "assistant" as const,
					content: [{ type: "text" as const, text: "I am an AI assistant." }],
					timestamp: Date.now(),
				},
				{
					role: "user" as const,
					content: [{ type: "text" as const, text: "What can you help me with?" }],
					timestamp: Date.now(),
				},
			],
		} as any;
		const response = await complete(testModel, context2);

		expect((response.content[0] as any).text).toContain("help");
	});

	// =========================================================================
	// Tool Usage Workflows
	// =========================================================================

	it("should execute tool calls and process results", async () => {
		// Setup: Tool call workflow
		provider.setResponses([
			fauxAssistantMessage([
				fauxText("Let me search for that information."),
				fauxToolCall("search", { query: "test query", limit: 5 }),
			]),
			fauxAssistantMessage([fauxText("I found the information you requested.")]),
		]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Find information about test queries" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, context);

		// Verification
		expect((response.content[0] as any).text).toContain("information");
	});

	it("should handle multi-step tool workflows", async () => {
		// Setup: Complex tool workflow
		const workflowResponses = [
			fauxAssistantMessage([fauxToolCall("get_data", { id: "123" })]),
			fauxAssistantMessage([fauxText("Processing the data...")]),
			fauxAssistantMessage([fauxToolCall("analyze_data", { dataset: "results" })]),
			fauxAssistantMessage([fauxText("Analysis complete: Results are ready.")]),
		];

		workflowResponses.forEach((resp, i) => {
			const p = registerFauxProvider({
				models: [{ id: `workflow-${i}`, name: `Workflow ${i}` }],
			});
			p.setResponses([resp]);
			if (i === 0) {
				provider = p;
				testModel = p.getModel(`workflow-${i}`)!;
			}
		});

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Analyze dataset 123" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, context);

		expect((response.content[0] as any).text).toContain("Analysis");
		expect((response.content[0] as any).text).toContain("complete");
	});

	it("should handle error conditions in tool workflows", async () => {
		// Setup: Tool error scenario
		provider.setResponses([
			fauxAssistantMessage([fauxText("Attempting to process..."), fauxToolCall("process_data", { data: "test" })]),
			fauxAssistantMessage([
				fauxText("I encountered an error. Let me try a different approach."),
				fauxToolCall("alternative_method", { input: "test" }),
			]),
			fauxAssistantMessage([fauxText("Success using alternative method!")]),
		]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Process this data" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, context);

		expect((response.content[0] as any).text).toContain("Success");
	});

	// =========================================================================
	// Complex Workflows
	// =========================================================================

	it("should handle thinking and reasoning workflows", async () => {
		// Setup: Reasoning workflow
		provider.setResponses([
			fauxAssistantMessage([
				fauxThinking("Let me break this down step by step."),
				fauxThinking("First, I need to understand the requirements."),
				fauxThinking("Then I can formulate a solution."),
				fauxText("Based on my analysis, here is the solution..."),
			]),
		]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Solve this complex problem" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, context);
		const thinkingBlocks = response.content.filter(
			(c: any): c is { type: "thinking"; thinking: string } => c.type === "thinking",
		);

		expect(thinkingBlocks.length).toBe(3);
		expect((response.content[response.content.length - 1] as any).text).toContain("solution");
	});

	it("should handle mixed content workflows", async () => {
		// Setup: Mixed text and thinking
		provider.setResponses([
			fauxAssistantMessage([
				fauxText("Let me analyze this."),
				fauxThinking("Considering various approaches..."),
				fauxText("The best approach is..."),
				fauxThinking("Let me verify this conclusion."),
				fauxText("Confirmed. The solution is correct."),
			]),
		]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Analyze and solve this" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, context);
		const textBlocks = response.content.filter((c: any): c is { type: "text"; text: string } => c.type === "text");
		const thinkingBlocks = response.content.filter(
			(c: any): c is { type: "thinking"; thinking: string } => c.type === "thinking",
		);

		expect(textBlocks.length).toBe(3);
		expect(thinkingBlocks.length).toBe(2);
	});

	it("should handle long context workflows", async () => {
		// Setup: Long conversation with many messages
		provider.setResponses([fauxAssistantMessage("I understand the full context.")]);

		const longContext: Context = {
			messages: Array.from({ length: 20 }, (_, i) => ({
				role: i % 2 === 0 ? "user" : "assistant",
				content: [
					{
						type: "text" as const,
						text: `Message ${i + 1} in the conversation`,
					},
				],
				timestamp: Date.now() + i * 1000,
			})),
		} as any;
		// Add final user message
		longContext.messages.push({
			role: "user" as const,
			content: [{ type: "text" as const, text: "What did we discuss?" }],
			timestamp: Date.now(),
		});

		const response = await complete(testModel, longContext);

		expect((response.content[0] as any).text).toContain("context");
	});

	// =========================================================================
	// Stream Workflows
	// =========================================================================

	it("should stream complete conversation events", async () => {
		// Setup: Stream workflow
		provider.setResponses([fauxAssistantMessage("Streaming response")]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Stream this response" }],
					timestamp: Date.now(),
				},
			],
		};

		const events: any[] = [];
		const eventStream = stream(testModel, context);

		for await (const event of eventStream) {
			events.push(event);
		}

		// Verification
		expect(events.length).toBeGreaterThan(0);

		const messageStart = events.find((e) => e.type === "message_start");
		const messageEnd = events.find((e) => e.type === "message_end");
		const agentEnd = events.find((e) => e.type === "agent_end");

		expect(messageStart).toBeDefined();
		expect(messageEnd).toBeDefined();
		expect(agentEnd).toBeDefined();
	});

	it("should stream thinking blocks incrementally", async () => {
		// Setup: Stream with thinking blocks
		provider.setResponses([
			fauxAssistantMessage([
				fauxThinking("First thought"),
				fauxText("Initial analysis"),
				fauxThinking("Second thought"),
				fauxText("Final analysis"),
			]),
		]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Analyze step by step" }],
					timestamp: Date.now(),
				},
			],
		};

		const events: any[] = [];
		const eventStream = stream(testModel, context);

		for await (const event of eventStream) {
			events.push(event);
		}

		// Verification
		const thinkingBlocks = events
			.filter((e) => e.type === "message_end")
			.flatMap((e) => e.message?.content || [])
			.filter((c: any) => c.type === "thinking");

		expect(thinkingBlocks.length).toBe(2);
	});

	// =========================================================================
	// Context Management Workflows
	// =========================================================================

	it("should maintain context across multiple operations", async () => {
		// Setup: Context accumulation
		const operations = 5;
		const currentContext: Context = {
			messages: [],
		};

		for (let i = 0; i < operations; i++) {
			const p = registerFauxProvider({
				models: [{ id: `ctx-${i}`, name: `Context ${i}` }],
			});
			p.setResponses([fauxAssistantMessage(`Operation ${i + 1} complete`)]);

			const model = p.getModel(`ctx-${i}`)!;
			currentContext.messages.push({
				role: "user",
				content: [{ type: "text", text: `Operation ${i + 1}` }],
				timestamp: Date.now(),
			});

			const response = await complete(model, currentContext);

			currentContext.messages.push({
				role: "assistant" as const,
				content: response.content,
				timestamp: Date.now(),
			} as any);

			p.unregister();
		}

		// Verification
		expect(currentContext.messages.length).toBe(operations * 2);
	});

	it("should handle context pruning scenarios", async () => {
		// Setup: Context that might need pruning
		provider.setResponses([fauxAssistantMessage("I can work with this context")]);

		const context: Context = {
			// Simulate context with many messages
			messages: Array.from({ length: 50 }, (_, i) => ({
				role: i % 2 === 0 ? "user" : "assistant",
				content: [
					{
						type: "text" as const,
						text: `Message ${i}: Lorem ipsum dolor sit amet`,
					},
				],
				timestamp: Date.now() + i * 1000,
			})).slice(0, 20), // Take first 20 to keep test manageable
		} as any;
		context.messages.push({
			role: "user",
			content: [{ type: "text", text: "Latest query" }],
			timestamp: Date.now(),
		});

		const response = await complete(testModel, context);

		expect((response.content[0] as any).text).toBeDefined();
	});

	// =========================================================================
	// Error Handling Workflows
	// =========================================================================

	it("should handle API errors gracefully in workflows", async () => {
		// Setup: Error scenario
		provider.setResponses([
			fauxAssistantMessage("Let me try that.", {
				errorMessage: "Service temporarily unavailable",
				stopReason: "error",
			}),
		]);

		const context: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Try this operation" }],
					timestamp: Date.now(),
				},
			],
		};

		const response = await complete(testModel, context);

		expect(response.stopReason).toBe("error");
		expect(response.errorMessage).toBeDefined();
	});

	it("should continue after error in multi-step workflow", async () => {
		// Setup: Error recovery
		const providers = [
			registerFauxProvider({
				models: [{ id: "step1", name: "Step 1" }],
			}),
			registerFauxProvider({
				models: [{ id: "step2", name: "Step 2" }],
			}),
		];

		providers[0].setResponses([
			fauxAssistantMessage("Failed step", {
				errorMessage: "Step 1 failed",
				stopReason: "error",
			}),
		]);
		providers[1].setResponses([fauxAssistantMessage("Recovered successfully")]);

		// Simulate error recovery
		const context1: Context = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Perform step 1" }],
					timestamp: Date.now(),
				},
			],
		};
		const response1 = await complete(providers[0].getModel("step1")!, context1);
		expect(response1.stopReason).toBe("error");

		const context2: Context = {
			messages: [
				...context1.messages,
				response1,
				{ role: "user", content: [{ type: "text", text: "Try step 2" }], timestamp: Date.now() },
			],
		};
		const response2 = await complete(providers[1].getModel("step2")!, context2);

		expect((response2.content[0] as any).text).toContain("Recovered");

		providers.forEach((p) => {
			p.unregister();
		});
	});
});
