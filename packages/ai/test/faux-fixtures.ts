/**
 * Comprehensive Faux Provider Fixtures for Testing
 *
 * This module provides pre-configured faux providers and response factories
 * for common testing scenarios.
 */

import type { FauxResponseStep, RegisterFauxProviderOptions } from "../src/providers/faux.js";
import {
	fauxAssistantMessage,
	fauxText,
	fauxThinking,
	fauxToolCall,
	registerFauxProvider,
} from "../src/providers/faux.js";
import type { Context, Tool } from "../src/types.js";

// ============================================================================
// Pre-configured Providers
// ============================================================================

/**
 * Register a standard test provider with common model configurations
 */
export function registerTestProvider(options: RegisterFauxProviderOptions = {}) {
	return registerFauxProvider({
		api: "test",
		provider: "test-provider",
		models: [
			{ id: "test-fast", name: "Test Fast", reasoning: false },
			{ id: "test-smart", name: "Test Smart", reasoning: true },
			{ id: "test-vision", name: "Test Vision", reasoning: false, input: ["text", "image"] },
		],
		...options,
	});
}

/**
 * Register a provider that simulates reasoning models
 */
export function registerReasoningProvider(options: RegisterFauxProviderOptions = {}) {
	return registerFauxProvider({
		api: "reasoning",
		provider: "test-reasoner",
		models: [
			{
				id: "reasoner-basic",
				name: "Basic Reasoner",
				reasoning: true,
				contextWindow: 8192,
				maxTokens: 2048,
			},
			{
				id: "reasoner-advanced",
				name: "Advanced Reasoner",
				reasoning: true,
				contextWindow: 32768,
				maxTokens: 4096,
			},
		],
		...options,
	});
}

/**
 * Register a provider with error scenarios
 */
export function registerErrorProneProvider(options: RegisterFauxProviderOptions = {}) {
	return registerFauxProvider({
		api: "error-test",
		provider: "error-provider",
		models: [{ id: "flaky-model", name: "Flaky Model", reasoning: false }],
		...options,
	});
}

/**
 * Register a provider for testing tool calls
 */
export function registerToolTestProvider(_tools: Tool[], options: RegisterFauxProviderOptions = {}) {
	return registerFauxProvider({
		api: "tool-test",
		provider: "tool-provider",
		models: [
			{
				id: "tool-user",
				name: "Tool User",
				reasoning: false,
				contextWindow: 16384,
			},
		],
		...options,
	});
}

// ============================================================================
// Response Factories
// ============================================================================

/**
 * Creates a response that echoes the input
 */
export function echoResponseFactory() {
	return (context: Context) => {
		const lastMessage = context.messages[context.messages.length - 1];
		const text = lastMessage?.content?.[0]?.text || "No input";
		return fauxAssistantMessage(`Echo: ${text}`);
	};
}

/**
 * Creates a response that simulates thinking
 */
export function thinkingResponseFactory(
	thoughts: string[] = ["Analyzing...", "Processing...", "Considering options..."],
) {
	return (_context: Context, _options: any, state: { callCount: number }) => {
		const thought = thoughts[state.callCount % thoughts.length];
		return fauxAssistantMessage([fauxThinking(thought), fauxText("I have completed my analysis.")]);
	};
}

/**
 * Creates a response that uses a tool
 */
export function toolUsingResponseFactory(toolName: string, toolArgs: any) {
	return () => {
		return fauxAssistantMessage([fauxText("I need to use a tool for this."), fauxToolCall(toolName, toolArgs)]);
	};
}

/**
 * Creates a multi-step response
 */
export function multiStepResponseFactory(steps: Array<string | FauxResponseStep>) {
	return (_context: Context, _options: any, state: { callCount: number }) => {
		const step = steps[state.callCount % steps.length];
		if (typeof step === "string") {
			return fauxAssistantMessage(step);
		}
		return step;
	};
}

/**
 * Creates a response that simulates different personas
 */
export function personaResponseFactory(personas: Record<string, string>) {
	const personaNames = Object.keys(personas);
	return (_context: Context, _options: any, state: { callCount: number }) => {
		const persona = personaNames[state.callCount % personaNames.length];
		const message = personas[persona];
		return fauxAssistantMessage(`[${persona}]: ${message}`);
	};
}

/**
 * Creates a response that fails with an error
 */
export function errorResponseFactory(errorMessage: string) {
	return () => {
		return fauxAssistantMessage("I encountered an error.", {
			errorMessage,
			stopReason: "error",
		});
	};
}

/**
 * Creates a response that simulates rate limiting
 */
export function rateLimitResponseFactory(retryAfter: number = 1) {
	return () => {
		throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
	};
}

// ============================================================================
// Common Response Patterns
// ============================================================================

/**
 * Standard test responses
 */
export const TEST_RESPONSES = {
	/** Simple text response */
	simple: [fauxAssistantMessage("This is a test response")],

	/** Thinking response */
	thinking: [
		fauxAssistantMessage([fauxThinking("Let me think about this..."), fauxText("Based on my analysis, I agree.")]),
	],

	/** Tool-using response */
	toolCall: [
		fauxAssistantMessage([
			fauxText("I'll search for that information."),
			fauxToolCall("search", { query: "test query", limit: 5 }),
		]),
	],

	/** Multi-step response */
	multiStep: [
		fauxAssistantMessage("Step 1: Understanding the problem"),
		fauxAssistantMessage("Step 2: Gathering information"),
		fauxAssistantMessage("Step 3: Analyzing data"),
		fauxAssistantMessage("Step 4: Providing solution"),
	],

	/** Error response */
	error: [
		fauxAssistantMessage("Something went wrong", {
			errorMessage: "Internal server error",
			stopReason: "error",
		}),
	],

	/** Empty response */
	empty: [fauxAssistantMessage("")],

	/** Long response */
	long: [
		fauxAssistantMessage(
			"Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
				"Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " +
				"Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
		),
	],
} as const;

/**
 * Response sequences for testing conversation flow
 */
export const CONVERSATION_SEQUENCES = {
	/** Simple Q&A */
	questionAnswer: [
		fauxAssistantMessage("I can help with that."),
		fauxAssistantMessage("Here's what I found:"),
		fauxAssistantMessage("Does this answer your question?"),
	],

	/** Tool usage sequence */
	toolUsage: [
		fauxAssistantMessage([fauxText("Let me check that for you.")]),
		fauxAssistantMessage([fauxToolCall("search", { query: "relevant information" })]),
		fauxAssistantMessage([fauxText("Based on the search results, here's what I found.")]),
	],

	/** Clarification sequence */
	clarification: [
		fauxAssistantMessage("I need more information."),
		fauxAssistantMessage("Could you clarify what you mean by that?"),
		fauxAssistantMessage("For example, are you referring to..."),
	],

	/** Error recovery */
	errorRecovery: [
		fauxAssistantMessage("I encountered an issue.", {
			errorMessage: "Network timeout",
			stopReason: "error",
		}),
		fauxAssistantMessage("Let me try again."),
		fauxAssistantMessage("I was able to complete the task successfully."),
	],
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a standard test context
 */
export function createTestContext(messages: any[] = []): Context {
	return {
		messages: messages.map((msg) => ({
			role: "user",
			content: [{ type: "text", text: msg }],
			timestamp: Date.now(),
		})),
	};
}

/**
 * Verifies a faux provider is working correctly
 */
export async function verifyFauxProvider(provider: any) {
	const model = provider.getModel();
	const _response = await provider.state.callCount;
	return {
		model: model.id,
		callCount: provider.state.callCount,
		pendingResponses: provider.getPendingResponseCount(),
	};
}
