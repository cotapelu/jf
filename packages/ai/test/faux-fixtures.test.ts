/**
 * Tests for Faux Provider Fixtures
 */

import { describe, expect, it } from "vitest";
import { complete } from "../src/index.js";
import {
	conversationSequences,
	createTestContext,
	echoResponseFactory,
	registerReasoningProvider,
	registerTestProvider,
	testResponses,
	thinkingResponseFactory,
	toolUsingResponseFactory,
} from "./faux-fixtures.js";

describe("faux provider fixtures", () => {
	it("should register test provider with standard models", async () => {
		const provider = registerTestProvider();

		expect(provider.models).toHaveLength(3);
		expect(provider.getModel("test-fast")).toBeDefined();
		expect(provider.getModel("test-smart")).toBeDefined();
		expect(provider.getModel("test-vision")).toBeDefined();
	});

	it("should register reasoning provider", async () => {
		const provider = registerReasoningProvider();

		expect(provider.models).toHaveLength(2);
		expect(provider.getModel("reasoner-basic")?.reasoning).toBe(true);
		expect(provider.getModel("reasoner-advanced")?.reasoning).toBe(true);
	});

	it("should echo response with echoResponseFactory", async () => {
		const provider = registerTestProvider();
		provider.setResponses([echoResponseFactory()]);

		const context = createTestContext(["Hello world"]);
		const response = await complete(provider.getModel("test-fast")!, context);

		expect(response.content).toHaveLength(1);
		expect(response.content[0].type).toBe("text");
		expect(response.content[0].text).toContain("Echo:");
	});

	it("should create thinking response", async () => {
		const provider = registerReasoningProvider();
		provider.setResponses([thinkingResponseFactory()]);

		const response = await complete(provider.getModel("reasoner-basic")!, {
			messages: [{ role: "user", content: [{ type: "text", text: "Think about this" }], timestamp: Date.now() }],
		});

		expect(response.content).toHaveLength(2);
		expect(response.content[0].type).toBe("thinking");
		expect(response.content[1].type).toBe("text");
	});

	it("should use tool in response", async () => {
		const provider = registerTestProvider();
		provider.setResponses([toolUsingResponseFactory("search", { query: "test" })]);

		const response = await complete(provider.getModel("test-fast")!, {
			messages: [{ role: "user", content: [{ type: "text", text: "Search for something" }], timestamp: Date.now() }],
		});

		expect(response.content).toHaveLength(2);
		expect(response.content[1].type).toBe("toolCall");
		expect(response.content[1].name).toBe("search");
	});

	it("should cycle through multi-step responses", async () => {
		const provider = registerTestProvider();
		const steps = ["Step 1", "Step 2", "Step 3"];
		provider.setResponses(steps.map((s) => () => ({ content: [{ type: "text", text: s }] })));

		const model = provider.getModel("test-fast")!;
		const context = {
			messages: [{ role: "user", content: [{ type: "text", text: "test" }], timestamp: Date.now() }],
		};

		const response1 = await complete(model, context);
		expect(response1.content[0].text).toBe("Step 1");

		const response2 = await complete(model, context);
		expect(response2.content[0].text).toBe("Step 2");

		const response3 = await complete(model, context);
		expect(response3.content[0].text).toBe("Step 3");
	});

	it("should use predefined test response", async () => {
		const provider = registerTestProvider();
		provider.setResponses(testResponses.simple);

		const response = await complete(provider.getModel("test-fast")!, {
			messages: [{ role: "user", content: [{ type: "text", text: "test" }], timestamp: Date.now() }],
		});

		expect(response.content[0].text).toBe("This is a test response");
	});

	it("should handle conversation sequences", async () => {
		const provider = registerTestProvider();
		provider.setResponses(conversationSequences.questionAnswer);

		const model = provider.getModel("test-fast")!;
		const context = {
			messages: [{ role: "user", content: [{ type: "text", text: "question" }], timestamp: Date.now() }],
		};

		const response1 = await complete(model, context);
		expect(response1.content[0].text).toBe("I can help with that.");

		const response2 = await complete(model, context);
		expect(response2.content[0].text).toBe("Here's what I found:");
	});

	it("should track call count in state", async () => {
		const provider = registerTestProvider();
		provider.setResponses([
			() => ({ content: [{ type: "text", text: "First" }] }),
			() => ({ content: [{ type: "text", text: "Second" }] }),
		]);

		const model = provider.getModel("test-fast")!;
		const context = {
			messages: [{ role: "user", content: [{ type: "text", text: "test" }], timestamp: Date.now() }],
		};

		expect(provider.state.callCount).toBe(0);

		await complete(model, context);
		expect(provider.state.callCount).toBe(1);

		await complete(model, context);
		expect(provider.state.callCount).toBe(2);
	});

	it("should handle empty response", async () => {
		const provider = registerTestProvider();
		provider.setResponses(testResponses.empty);

		const response = await complete(provider.getModel("test-fast")!, {
			messages: [{ role: "user", content: [{ type: "text", text: "test" }], timestamp: Date.now() }],
		});

		expect(response.content).toHaveLength(1);
		expect(response.content[0].text).toBe("");
	});

	it("should handle reasoning model", async () => {
		const provider = registerReasoningProvider();
		provider.setResponses([fauxAssistantMessage([fauxThinking("Deep thoughts..."), fauxText("Final answer")])]);

		const response = await complete(provider.getModel("reasoner-basic")!, {
			messages: [{ role: "user", content: [{ type: "text", text: "Complex question" }], timestamp: Date.now() }],
		});

		expect(response.content).toHaveLength(2);
		expect(response.content[0].type).toBe("thinking");
	});
});
